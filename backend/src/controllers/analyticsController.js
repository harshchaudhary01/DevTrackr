const Analytics = require('../models/Analytics');
const Repository = require('../models/Repository');
const { catchAsync } = require('../middleware/errorMiddleware');

/**
 * GET /api/analytics/:repoId
 * Get full analytics for a repository
 */
const getAnalytics = catchAsync(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.repoId, owner: req.user._id });
  if (!repo) return res.status(404).json({ success: false, message: 'Repository not found.' });

  const analytics = await Analytics.findOne({ repository: repo._id, owner: req.user._id });
  if (!analytics) {
    return res.status(404).json({
      success: false,
      message: 'No analytics found. Please sync the repository first.',
    });
  }

  res.json({ success: true, analytics });
});

/**
 * GET /api/analytics/:repoId/metrics
 * Get just the metrics summary (lightweight endpoint for dashboard cards)
 */
const getMetrics = catchAsync(async (req, res) => {
  const analytics = await Analytics.findOne(
    { repository: req.params.repoId, owner: req.user._id },
    'metrics lastCalculated'
  );

  if (!analytics) {
    return res.status(404).json({ success: false, message: 'No analytics data found. Sync the repository first.' });
  }

  res.json({ success: true, metrics: analytics.metrics, lastCalculated: analytics.lastCalculated });
});

/**
 * GET /api/analytics/:repoId/commits
 * Get commit data for charts
 */
const getCommitAnalytics = catchAsync(async (req, res) => {
  const analytics = await Analytics.findOne(
    { repository: req.params.repoId, owner: req.user._id },
    'commits weeklyActivity heatmapData metrics.totalCommits metrics.commitFrequencyPerDay'
  );

  if (!analytics) return res.status(404).json({ success: false, message: 'No data found.' });

  // Group commits by date for trend chart
  const commitsByDate = {};
  analytics.commits.forEach((c) => {
    if (!c.date) return;
    const date = new Date(c.date).toISOString().split('T')[0];
    commitsByDate[date] = (commitsByDate[date] || 0) + 1;
  });

  const commitTrend = Object.entries(commitsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30); // last 30 days

  res.json({
    success: true,
    commitTrend,
    weeklyActivity: analytics.weeklyActivity.slice(-12), // last 12 weeks
    heatmapData: analytics.heatmapData,
    total: analytics.metrics?.totalCommits || 0,
    frequency: analytics.metrics?.commitFrequencyPerDay || 0,
  });
});

/**
 * GET /api/analytics/:repoId/prs
 * Get PR analytics data
 */
const getPRAnalytics = catchAsync(async (req, res) => {
  const analytics = await Analytics.findOne(
    { repository: req.params.repoId, owner: req.user._id },
    'pullRequests metrics weeklyActivity'
  );

  if (!analytics) return res.status(404).json({ success: false, message: 'No data found.' });

  const prs = analytics.pullRequests;
  const merged = prs.filter((p) => p.state === 'merged');
  const open = prs.filter((p) => p.state === 'open');
  const closed = prs.filter((p) => p.state === 'closed');

  // Merge time distribution
  const mergeTimes = merged
    .filter((p) => p.mergeTimeHours)
    .map((p) => ({ pr: p.prNumber, hours: Math.round(p.mergeTimeHours), title: p.title?.slice(0, 40) }))
    .slice(-20);

  res.json({
    success: true,
    summary: {
      total: prs.length,
      merged: merged.length,
      open: open.length,
      closed: closed.length,
      avgMergeTimeHours: analytics.metrics?.avgPRMergeTimeHours || 0,
    },
    mergeTimes,
    recentPRs: prs.slice(-10).reverse(),
  });
});

/**
 * GET /api/analytics/:repoId/issues
 * Get issue analytics
 */
const getIssueAnalytics = catchAsync(async (req, res) => {
  const analytics = await Analytics.findOne(
    { repository: req.params.repoId, owner: req.user._id },
    'issues metrics'
  );

  if (!analytics) return res.status(404).json({ success: false, message: 'No data found.' });

  const issues = analytics.issues;
  const open = issues.filter((i) => i.state === 'open');
  const closed = issues.filter((i) => i.state === 'closed');

  // Label distribution
  const labelCount = {};
  issues.forEach((i) => i.labels?.forEach((l) => { labelCount[l] = (labelCount[l] || 0) + 1; }));
  const labelDistribution = Object.entries(labelCount)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({
    success: true,
    summary: {
      total: issues.length,
      open: open.length,
      closed: closed.length,
      avgResolutionTimeHours: analytics.metrics?.avgIssueResolutionTimeHours || 0,
    },
    labelDistribution,
    recentIssues: issues.slice(-10).reverse(),
  });
});

/**
 * GET /api/analytics/:repoId/contributors
 * Get contributor analytics
 */
const getContributorAnalytics = catchAsync(async (req, res) => {
  const analytics = await Analytics.findOne(
    { repository: req.params.repoId, owner: req.user._id },
    'contributors metrics'
  );

  if (!analytics) return res.status(404).json({ success: false, message: 'No data found.' });

  res.json({
    success: true,
    contributors: analytics.contributors.sort((a, b) => b.totalCommits - a.totalCommits),
    summary: {
      total: analytics.metrics?.totalContributors || 0,
      inactive: analytics.metrics?.inactiveContributors || 0,
      active: (analytics.metrics?.totalContributors || 0) - (analytics.metrics?.inactiveContributors || 0),
    },
  });
});

module.exports = {
  getAnalytics,
  getMetrics,
  getCommitAnalytics,
  getPRAnalytics,
  getIssueAnalytics,
  getContributorAnalytics,
};