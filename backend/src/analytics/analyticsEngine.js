/**
 * DevTrackr Analytics Engine
 * Computes all metrics from raw GitHub data
 */

const INACTIVE_DAYS_THRESHOLD = 14;

/**
 * Compute all analytics metrics from raw data
 * @param {Array} commits
 * @param {Array} pullRequests
 * @param {Array} issues
 * @param {Array} contributors
 * @returns {object} computed metrics
 */
const computeMetrics = (commits, pullRequests, issues, contributors) => {
  const totalCommits = commits.length;
  const totalPRs = pullRequests.length;
  const totalIssues = issues.length;
  const totalContributors = contributors.length;

  // PR metrics
  const mergedPRs = pullRequests.filter((pr) => pr.state === 'merged');
  const openPRs = pullRequests.filter((pr) => pr.state === 'open');
  const closedPRs = pullRequests.filter((pr) => pr.state === 'closed');

  const avgPRMergeTimeHours =
    mergedPRs.length > 0
      ? mergedPRs.reduce((sum, pr) => sum + (pr.mergeTimeHours || 0), 0) / mergedPRs.length
      : 0;

  // Issue metrics
  const closedIssues = issues.filter((i) => i.state === 'closed');
  const openIssues = issues.filter((i) => i.state === 'open');

  const avgIssueResolutionTimeHours =
    closedIssues.length > 0
      ? closedIssues.reduce((sum, i) => sum + (i.resolutionTimeHours || 0), 0) / closedIssues.length
      : 0;

  // Commit frequency (commits per day over last 90 days)
  const commitFrequencyPerDay = totalCommits > 0 ? totalCommits / 90 : 0;

  // Code changes
  const totalAdditions = commits.reduce((sum, c) => sum + (c.additions || 0), 0);
  const totalDeletions = commits.reduce((sum, c) => sum + (c.deletions || 0), 0);

  // Inactive contributors detection
  const now = new Date();
  const inactiveThreshold = new Date(now.getTime() - INACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000);

  // Build last-active map from commits
  const contributorLastActive = {};
  commits.forEach((c) => {
    if (!c.author || !c.date) return;
    const date = new Date(c.date);
    if (!contributorLastActive[c.author] || date > contributorLastActive[c.author]) {
      contributorLastActive[c.author] = date;
    }
  });

  const enrichedContributors = contributors.map((c) => {
    const lastDate = contributorLastActive[c.login] || null;
    const isInactive = lastDate ? lastDate < inactiveThreshold : true;
    return { ...c, lastActiveDate: lastDate, isInactive };
  });

  const inactiveContributorCount = enrichedContributors.filter((c) => c.isInactive).length;

  // Compute productivity score (0-100)
  const productivityScore = computeProductivityScore({
    commitFrequencyPerDay,
    prMergeRate: totalPRs > 0 ? (mergedPRs.length / totalPRs) * 100 : 0,
    issueResolutionRate: totalIssues > 0 ? (closedIssues.length / totalIssues) * 100 : 0,
    avgPRMergeTimeHours,
    inactiveRatio: totalContributors > 0 ? (inactiveContributorCount / totalContributors) * 100 : 0,
  });

  // Compute health score (0-100)
  const healthScore = computeHealthScore({
    productivityScore,
    openPRCount: openPRs.length,
    openIssueCount: openIssues.length,
    inactiveRatio: totalContributors > 0 ? (inactiveContributorCount / totalContributors) * 100 : 0,
    avgPRMergeTimeHours,
    commitFrequencyPerDay,
  });

  return {
    totalCommits,
    totalPRs,
    totalIssues,
    totalContributors,
    avgPRMergeTimeHours: Math.round(avgPRMergeTimeHours * 10) / 10,
    avgIssueResolutionTimeHours: Math.round(avgIssueResolutionTimeHours * 10) / 10,
    commitFrequencyPerDay: Math.round(commitFrequencyPerDay * 100) / 100,
    openPRCount: openPRs.length,
    closedPRCount: closedPRs.length + mergedPRs.length,
    openIssueCount: openIssues.length,
    closedIssueCount: closedIssues.length,
    inactiveContributors: inactiveContributorCount,
    totalAdditions,
    totalDeletions,
    productivityScore,
    healthScore,
    enrichedContributors,
  };
};

/**
 * Compute productivity score 0-100
 */
const computeProductivityScore = (data) => {
  let score = 0;

  // Commit frequency (max 25 points)
  // 0 commits/day = 0, 1+ = 25
  const commitScore = Math.min(25, data.commitFrequencyPerDay * 25);
  score += commitScore;

  // PR merge rate (max 25 points)
  score += (data.prMergeRate / 100) * 25;

  // Issue resolution rate (max 20 points)
  score += (data.issueResolutionRate / 100) * 20;

  // PR merge speed (max 20 points)
  // Under 24h = 20pts, 24-48h = 15pts, 48-72h = 10pts, 72h+ = 5pts
  if (data.avgPRMergeTimeHours <= 24) score += 20;
  else if (data.avgPRMergeTimeHours <= 48) score += 15;
  else if (data.avgPRMergeTimeHours <= 72) score += 10;
  else score += 5;

  // Active contributors bonus (max 10 points)
  // Penalize if >50% inactive
  score += Math.max(0, 10 - (data.inactiveRatio / 100) * 10);

  return Math.round(Math.min(100, Math.max(0, score)));
};

/**
 * Compute health score 0-100
 */
const computeHealthScore = (data) => {
  let score = 100;

  // Deduct for high open PRs (bottleneck)
  if (data.openPRCount > 20) score -= 20;
  else if (data.openPRCount > 10) score -= 10;
  else if (data.openPRCount > 5) score -= 5;

  // Deduct for high open issues
  if (data.openIssueCount > 50) score -= 20;
  else if (data.openIssueCount > 20) score -= 10;
  else if (data.openIssueCount > 10) score -= 5;

  // Deduct for slow PR merges
  if (data.avgPRMergeTimeHours > 72) score -= 15;
  else if (data.avgPRMergeTimeHours > 48) score -= 10;

  // Deduct for inactive contributors
  if (data.inactiveRatio > 70) score -= 20;
  else if (data.inactiveRatio > 50) score -= 10;

  // Deduct for low commit frequency
  if (data.commitFrequencyPerDay < 0.1) score -= 15;
  else if (data.commitFrequencyPerDay < 0.3) score -= 8;

  // Base adjustment from productivity
  score = score * 0.6 + data.productivityScore * 0.4;

  return Math.round(Math.min(100, Math.max(0, score)));
};

/**
 * Detect stale PRs (open for more than 48 hours)
 */
const detectStalePRs = (pullRequests) => {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return pullRequests.filter(
    (pr) => pr.state === 'open' && new Date(pr.createdAt) < fortyEightHoursAgo
  ).length;
};

/**
 * Detect stale issues (open for more than 7 days)
 */
const detectStaleIssues = (issues) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return issues.filter(
    (i) => i.state === 'open' && new Date(i.createdAt) < sevenDaysAgo
  ).length;
};

/**
 * Compute commit trend (last 4 weeks vs previous 4 weeks)
 * @returns {string} 'increasing' | 'decreasing' | 'stable'
 */
const computeCommitTrend = (commits) => {
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

  const recent = commits.filter((c) => c.date && new Date(c.date) > fourWeeksAgo).length;
  const previous = commits.filter((c) => c.date && new Date(c.date) > eightWeeksAgo && new Date(c.date) <= fourWeeksAgo).length;

  if (previous === 0) return 'stable';
  const change = ((recent - previous) / previous) * 100;

  if (change > 10) return 'increasing';
  if (change < -10) return 'decreasing';
  return 'stable';
};

/**
 * Build data payload for AI services from metrics
 */
const buildAIDataPayload = (repoName, repoData, metrics) => {
  const mergedPRs = repoData.pullRequests.filter((pr) => pr.state === 'merged');
  const topContributor = repoData.contributors.sort((a, b) => b.totalCommits - a.totalCommits)[0];
  const topContributorShare = metrics.totalCommits > 0 && topContributor
    ? Math.round((topContributor.totalCommits / metrics.totalCommits) * 100)
    : 0;

  const lastCommit = repoData.commits.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const daysSinceLastCommit = lastCommit?.date
    ? Math.round((Date.now() - new Date(lastCommit.date)) / (1000 * 60 * 60 * 24))
    : 999;

  return {
    repoName,
    totalCommits: metrics.totalCommits,
    totalPRs: metrics.totalPRs,
    openPRs: metrics.openPRCount,
    mergedPRs: mergedPRs.length,
    totalIssues: metrics.totalIssues,
    openIssues: metrics.openIssueCount,
    closedIssues: metrics.closedIssueCount,
    activeContributors: metrics.totalContributors - metrics.inactiveContributors,
    totalContributors: metrics.totalContributors,
    avgPRMergeTime: metrics.avgPRMergeTimeHours,
    totalAdditions: metrics.totalAdditions,
    totalDeletions: metrics.totalDeletions,
    topContributor: topContributor?.login || 'None',
    topContributorShare,
    weeklyTrend: computeCommitTrend(repoData.commits),
    productivityScore: metrics.productivityScore,
    healthScore: metrics.healthScore,
    commitFrequency: metrics.commitFrequencyPerDay,
    prMergeRate: metrics.totalPRs > 0 ? Math.round((mergedPRs.length / metrics.totalPRs) * 100) : 0,
    issueResolutionRate: metrics.totalIssues > 0 ? Math.round((metrics.closedIssueCount / metrics.totalIssues) * 100) : 0,
    avgIssueResolutionTime: metrics.avgIssueResolutionTimeHours,
    inactiveContributors: metrics.inactiveContributors,
    inactiveRatio: metrics.totalContributors > 0 ? Math.round((metrics.inactiveContributors / metrics.totalContributors) * 100) : 0,
    stalePRs: detectStalePRs(repoData.pullRequests),
    staleIssues: detectStaleIssues(repoData.issues),
    prReviewParticipation: 70, // approximate
    issueAssignmentRate: 60, // approximate
    commitTrend: computeCommitTrend(repoData.commits),
    daysSinceLastCommit,
    codeChurn: metrics.totalAdditions > 0 ? Math.round((metrics.totalDeletions / metrics.totalAdditions) * 100) : 0,
    codeRatio: `${metrics.totalAdditions}/${metrics.totalDeletions}`,
    stars: repoData.repo?.stars || 0,
    forks: repoData.repo?.forks || 0,
    language: repoData.repo?.language || 'Unknown',
  };
};

module.exports = {
  computeMetrics,
  detectStalePRs,
  detectStaleIssues,
  computeCommitTrend,
  buildAIDataPayload,
};