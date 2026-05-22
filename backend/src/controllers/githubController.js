const User = require('../models/User');
const Repository = require('../models/Repository');
const Analytics = require('../models/Analytics');
const {
  getGithubUser,
  getUserRepositories,
  getRepositoryCommits,
  getRepositoryPullRequests,
  getRepositoryIssues,
  getRepositoryContributors,
  buildHeatmapData,
  buildWeeklyActivity,
} = require('../services/githubService');
const { computeMetrics } = require('../analytics/analyticsEngine');
const { catchAsync } = require('../middleware/errorMiddleware');

/**
 * POST /api/github/connect
 * Save GitHub personal access token and fetch user info
 */
const connectGithub = catchAsync(async (req, res) => {
  const { token } = req.body;

  if (!token || token.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Valid GitHub token is required.' });
  }

  // Validate token by fetching GitHub user
  let githubUser;
  try {
    githubUser = await getGithubUser(token.trim());
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid GitHub token. Please check and try again.' });
  }

  // Save token and GitHub info to user
  await User.findByIdAndUpdate(req.user._id, {
    githubToken: token.trim(),
    githubUsername: githubUser.login,
    githubAvatar: githubUser.avatar_url,
  });

  res.json({
    success: true,
    message: `GitHub account "${githubUser.login}" connected successfully!`,
    github: {
      login: githubUser.login,
      avatar: githubUser.avatar_url,
      name: githubUser.name,
      publicRepos: githubUser.public_repos,
    },
  });
});

/**
 * GET /api/github/repos
 * Fetch all repositories from GitHub for the connected user
 */
const getRepositories = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('+githubToken');

  if (!user.githubToken) {
    return res.status(400).json({ success: false, message: 'GitHub not connected. Please add your GitHub token first.' });
  }

  const repos = await getUserRepositories(user.githubToken);

  // Return formatted list (not saved to DB yet - save only when user selects)
  const formatted = repos.map((r) => ({
    githubId: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description || '',
    url: r.html_url,
    language: r.language || 'Unknown',
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    openIssues: r.open_issues_count || 0,
    isPrivate: r.private,
    defaultBranch: r.default_branch || 'main',
    updatedAt: r.updated_at,
  }));

  res.json({ success: true, repositories: formatted, total: formatted.length });
});

/**
 * POST /api/github/repos/track
 * Add a repository to track (save to DB)
 */
const trackRepository = catchAsync(async (req, res) => {
  const { githubId, name, fullName, description, url, language, stars, forks, openIssues, isPrivate, defaultBranch } = req.body;

  if (!githubId || !name || !fullName) {
    return res.status(400).json({ success: false, message: 'Repository data is required.' });
  }

  // Upsert repository
  const repo = await Repository.findOneAndUpdate(
    { owner: req.user._id, githubId },
    { owner: req.user._id, githubId, name, fullName, description, url, language, stars, forks, openIssues, isPrivate, defaultBranch, isActive: true },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  // Add to user's connectedRepos if not already there
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { connectedRepos: repo._id },
  });

  res.json({ success: true, message: `Repository "${name}" is now being tracked.`, repository: repo });
});

/**
 * DELETE /api/github/repos/:repoId
 * Stop tracking a repository
 */
const untrackRepository = catchAsync(async (req, res) => {
  const repo = await Repository.findOneAndUpdate(
    { _id: req.params.repoId, owner: req.user._id },
    { isActive: false },
    { returnDocument: 'after' }
  );

  if (!repo) {
    return res.status(404).json({ success: false, message: 'Repository not found.' });
  }

  res.json({ success: true, message: `Stopped tracking "${repo.name}".` });
});

/**
 * GET /api/github/tracked
 * Get all tracked repositories for the user
 */
const getTrackedRepositories = catchAsync(async (req, res) => {
  const repos = await Repository.find({ owner: req.user._id, isActive: true }).sort({ updatedAt: -1 });
  res.json({ success: true, repositories: repos });
});

/**
 * POST /api/github/sync/:repoId
 * Sync a repository - fetch all data from GitHub and compute analytics
 */
const syncRepository = catchAsync(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.repoId, owner: req.user._id });

  if (!repo) {
    return res.status(404).json({ success: false, message: 'Repository not found.' });
  }

  const user = await User.findById(req.user._id).select('+githubToken');
  if (!user.githubToken) {
    return res.status(400).json({ success: false, message: 'GitHub not connected.' });
  }

  const [ownerLogin, repoName] = repo.fullName.split('/');

  // Fetch all data in parallel where possible
  const [commits, pullRequests, issues, contributors] = await Promise.allSettled([
    getRepositoryCommits(user.githubToken, ownerLogin, repoName),
    getRepositoryPullRequests(user.githubToken, ownerLogin, repoName),
    getRepositoryIssues(user.githubToken, ownerLogin, repoName),
    getRepositoryContributors(user.githubToken, ownerLogin, repoName),
  ]);

  const commitsData = commits.status === 'fulfilled' ? commits.value : [];
  const prsData = pullRequests.status === 'fulfilled' ? pullRequests.value : [];
  const issuesData = issues.status === 'fulfilled' ? issues.value : [];
  const contributorsData = contributors.status === 'fulfilled' ? contributors.value : [];

  // Compute metrics
  const metrics = computeMetrics(commitsData, prsData, issuesData, contributorsData);

  // Build heatmap and weekly activity
  const heatmapData = buildHeatmapData(commitsData);
  const weeklyActivity = buildWeeklyActivity(commitsData, prsData, issuesData);

  // Upsert analytics document
  await Analytics.findOneAndUpdate(
    { repository: repo._id, owner: req.user._id },
    {
      repository: repo._id,
      owner: req.user._id,
      commits: commitsData.slice(0, 500), // Store last 500 commits
      pullRequests: prsData.slice(0, 200),
      issues: issuesData.slice(0, 200),
      contributors: metrics.enrichedContributors,
      weeklyActivity,
      heatmapData,
      metrics: {
        totalCommits: metrics.totalCommits,
        totalPRs: metrics.totalPRs,
        totalIssues: metrics.totalIssues,
        totalContributors: metrics.totalContributors,
        avgPRMergeTimeHours: metrics.avgPRMergeTimeHours,
        avgIssueResolutionTimeHours: metrics.avgIssueResolutionTimeHours,
        commitFrequencyPerDay: metrics.commitFrequencyPerDay,
        openPRCount: metrics.openPRCount,
        closedPRCount: metrics.closedPRCount,
        openIssueCount: metrics.openIssueCount,
        closedIssueCount: metrics.closedIssueCount,
        inactiveContributors: metrics.inactiveContributors,
        totalAdditions: metrics.totalAdditions,
        totalDeletions: metrics.totalDeletions,
        productivityScore: metrics.productivityScore,
        healthScore: metrics.healthScore,
      },
      lastCalculated: new Date(),
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Update repo last synced
  await Repository.findByIdAndUpdate(repo._id, { lastSynced: new Date() });

  res.json({
    success: true,
    message: `Repository "${repo.name}" synced successfully!`,
    summary: {
      commits: commitsData.length,
      pullRequests: prsData.length,
      issues: issuesData.length,
      contributors: contributorsData.length,
      productivityScore: metrics.productivityScore,
      healthScore: metrics.healthScore,
    },
  });
});

module.exports = {
  connectGithub,
  getRepositories,
  trackRepository,
  untrackRepository,
  getTrackedRepositories,
  syncRepository,
};
