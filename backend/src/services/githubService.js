const { createGithubClient, fetchAllPages, hoursBetween, formatDate, getISOWeek } = require('../utils/githubUtils');

/**
 * Fetch authenticated GitHub user profile
 * @param {string} token
 * @returns {object} GitHub user object
 */
const getGithubUser = async (token) => {
  const client = createGithubClient(token);
  const response = await client.get('/user');
  return response.data;
};

/**
 * Fetch all repositories for authenticated user
 * @param {string} token
 * @returns {Array} list of repos
 */
const getUserRepositories = async (token) => {
  const client = createGithubClient(token);
  const repos = await fetchAllPages(client, '/user/repos', {
    sort: 'updated',
    type: 'all',
  });
  return repos;
};

/**
 * Fetch commits for a repository (last 90 days)
 * @param {string} token
 * @param {string} owner - repo owner login
 * @param {string} repo - repo name
 * @returns {Array} commits
 */
const getRepositoryCommits = async (token, owner, repo) => {
  const client = createGithubClient(token);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const commits = await fetchAllPages(
    client,
    `/repos/${owner}/${repo}/commits`,
    { since },
    15 // max 1500 commits
  );

  // Map to our format
  return commits.map((c) => ({
    sha: c.sha,
    message: c.commit?.message || '',
    author: c.commit?.author?.name || c.author?.login || 'Unknown',
    authorEmail: c.commit?.author?.email || '',
    date: c.commit?.author?.date || null,
    additions: 0, // would need per-commit detail call - expensive, skip
    deletions: 0,
    filesChanged: 0,
  }));
};

/**
 * Fetch pull requests for a repository
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @returns {Array} pull requests
 */
const getRepositoryPullRequests = async (token, owner, repo) => {
  const client = createGithubClient(token);

  // Fetch both open and closed PRs
  const [openPRs, closedPRs] = await Promise.all([
    fetchAllPages(client, `/repos/${owner}/${repo}/pulls`, { state: 'open' }, 5),
    fetchAllPages(client, `/repos/${owner}/${repo}/pulls`, { state: 'closed' }, 5),
  ]);

  const allPRs = [...openPRs, ...closedPRs];

  return allPRs.map((pr) => ({
    prNumber: pr.number,
    title: pr.title,
    state: pr.merged_at ? 'merged' : pr.state,
    author: pr.user?.login || 'Unknown',
    createdAt: pr.created_at,
    closedAt: pr.closed_at,
    mergedAt: pr.merged_at,
    mergeTimeHours: pr.merged_at
      ? hoursBetween(pr.created_at, pr.merged_at)
      : null,
    reviewCount: pr.requested_reviewers?.length || 0,
    commentCount: pr.comments || 0,
  }));
};

/**
 * Fetch issues for a repository
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @returns {Array} issues
 */
const getRepositoryIssues = async (token, owner, repo) => {
  const client = createGithubClient(token);

  const [openIssues, closedIssues] = await Promise.all([
    fetchAllPages(client, `/repos/${owner}/${repo}/issues`, { state: 'open' }, 5),
    fetchAllPages(client, `/repos/${owner}/${repo}/issues`, { state: 'closed' }, 5),
  ]);

  const allIssues = [...openIssues, ...closedIssues].filter(
    (i) => !i.pull_request // exclude PRs that appear as issues
  );

  return allIssues.map((issue) => ({
    issueNumber: issue.number,
    title: issue.title,
    state: issue.state,
    author: issue.user?.login || 'Unknown',
    labels: issue.labels?.map((l) => l.name) || [],
    createdAt: issue.created_at,
    closedAt: issue.closed_at,
    resolutionTimeHours: issue.closed_at
      ? hoursBetween(issue.created_at, issue.closed_at)
      : null,
    commentCount: issue.comments || 0,
  }));
};

/**
 * Fetch contributors for a repository
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @returns {Array} contributors
 */
const getRepositoryContributors = async (token, owner, repo) => {
  const client = createGithubClient(token);
  const contributors = await fetchAllPages(
    client,
    `/repos/${owner}/${repo}/contributors`,
    {},
    3
  );

  return contributors.map((c) => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    totalCommits: c.contributions,
  }));
};

/**
 * Fetch contributor activity (weekly commit stats from GitHub stats API)
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @returns {Array} weekly stats
 */
const getRepositoryStats = async (token, owner, repo) => {
  const client = createGithubClient(token);

  try {
    // GitHub stats API may return 202 (processing) on first call
    let retries = 3;
    let response;

    while (retries > 0) {
      response = await client.get(`/repos/${owner}/${repo}/stats/commit_activity`);
      if (response.status === 200) break;
      await new Promise((r) => setTimeout(r, 2000)); // wait 2s for GitHub to process
      retries--;
    }

    return response?.data || [];
  } catch {
    return [];
  }
};

/**
 * Build contribution heatmap (last 365 days) from commits array
 * @param {Array} commits
 * @returns {Array} heatmap data [{date, count}]
 */
const buildHeatmapData = (commits) => {
  const countMap = {};
  const now = new Date();
  const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  commits.forEach((c) => {
    if (!c.date) return;
    const date = formatDate(c.date);
    if (new Date(date) >= yearAgo) {
      countMap[date] = (countMap[date] || 0) + 1;
    }
  });

  return Object.entries(countMap).map(([date, count]) => ({ date, count }));
};

/**
 * Build weekly activity from commits, PRs, issues
 */
const buildWeeklyActivity = (commits, pullRequests, issues) => {
  const weekMap = {};

  commits.forEach((c) => {
    if (!c.date) return;
    const week = getISOWeek(new Date(c.date));
    if (!weekMap[week]) weekMap[week] = { week, commits: 0, prsOpened: 0, prsMerged: 0, issuesOpened: 0, issuesClosed: 0, additions: 0, deletions: 0 };
    weekMap[week].commits++;
    weekMap[week].additions += c.additions || 0;
    weekMap[week].deletions += c.deletions || 0;
  });

  pullRequests.forEach((pr) => {
    if (pr.createdAt) {
      const week = getISOWeek(new Date(pr.createdAt));
      if (!weekMap[week]) weekMap[week] = { week, commits: 0, prsOpened: 0, prsMerged: 0, issuesOpened: 0, issuesClosed: 0, additions: 0, deletions: 0 };
      weekMap[week].prsOpened++;
    }
    if (pr.mergedAt) {
      const week = getISOWeek(new Date(pr.mergedAt));
      if (!weekMap[week]) weekMap[week] = { week, commits: 0, prsOpened: 0, prsMerged: 0, issuesOpened: 0, issuesClosed: 0, additions: 0, deletions: 0 };
      weekMap[week].prsMerged++;
    }
  });

  issues.forEach((issue) => {
    if (issue.createdAt) {
      const week = getISOWeek(new Date(issue.createdAt));
      if (!weekMap[week]) weekMap[week] = { week, commits: 0, prsOpened: 0, prsMerged: 0, issuesOpened: 0, issuesClosed: 0, additions: 0, deletions: 0 };
      weekMap[week].issuesOpened++;
    }
    if (issue.closedAt) {
      const week = getISOWeek(new Date(issue.closedAt));
      if (!weekMap[week]) weekMap[week] = { week, commits: 0, prsOpened: 0, prsMerged: 0, issuesOpened: 0, issuesClosed: 0, additions: 0, deletions: 0 };
      weekMap[week].issuesClosed++;
    }
  });

  return Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
};

module.exports = {
  getGithubUser,
  getUserRepositories,
  getRepositoryCommits,
  getRepositoryPullRequests,
  getRepositoryIssues,
  getRepositoryContributors,
  getRepositoryStats,
  buildHeatmapData,
  buildWeeklyActivity,
};