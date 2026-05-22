const Repository = require('../models/Repository');
const Analytics = require('../models/Analytics');
const AIInsights = require('../models/AIInsights');
const { catchAsync } = require('../middleware/errorMiddleware');

/**
 * GET /api/dashboard/overview
 * Aggregated dashboard overview for all tracked repos
 */
const getDashboardOverview = catchAsync(async (req, res) => {
  const repos = await Repository.find({ owner: req.user._id, isActive: true });

  if (repos.length === 0) {
    return res.json({
      success: true,
      overview: {
        totalRepos: 0,
        totalCommits: 0,
        totalPRs: 0,
        totalIssues: 0,
        avgProductivityScore: 0,
        avgHealthScore: 0,
      },
      repos: [],
    });
  }

  const repoIds = repos.map((r) => r._id);

  // Get analytics for all repos
  const allAnalytics = await Analytics.find(
    { repository: { $in: repoIds }, owner: req.user._id },
    'repository metrics lastCalculated'
  );

  // Map analytics to repos
  const analyticsMap = {};
  allAnalytics.forEach((a) => {
    analyticsMap[a.repository.toString()] = a;
  });

  // Aggregate overview metrics
  let totalCommits = 0;
  let totalPRs = 0;
  let totalIssues = 0;
  let totalProductivity = 0;
  let totalHealth = 0;
  let analyzedCount = 0;

  const repoSummaries = repos.map((repo) => {
    const analytics = analyticsMap[repo._id.toString()];
    if (analytics) {
      totalCommits += analytics.metrics?.totalCommits || 0;
      totalPRs += analytics.metrics?.totalPRs || 0;
      totalIssues += analytics.metrics?.totalIssues || 0;
      totalProductivity += analytics.metrics?.productivityScore || 0;
      totalHealth += analytics.metrics?.healthScore || 0;
      analyzedCount++;
    }

    return {
      id: repo._id,
      name: repo.name,
      fullName: repo.fullName,
      language: repo.language,
      stars: repo.stars,
      lastSynced: repo.lastSynced,
      metrics: analytics ? {
        totalCommits: analytics.metrics?.totalCommits || 0,
        totalPRs: analytics.metrics?.totalPRs || 0,
        openPRs: analytics.metrics?.openPRCount || 0,
        openIssues: analytics.metrics?.openIssueCount || 0,
        productivityScore: analytics.metrics?.productivityScore || 0,
        healthScore: analytics.metrics?.healthScore || 0,
        lastCalculated: analytics.lastCalculated,
      } : null,
    };
  });

  res.json({
    success: true,
    overview: {
      totalRepos: repos.length,
      totalCommits,
      totalPRs,
      totalIssues,
      avgProductivityScore: analyzedCount > 0 ? Math.round(totalProductivity / analyzedCount) : 0,
      avgHealthScore: analyzedCount > 0 ? Math.round(totalHealth / analyzedCount) : 0,
    },
    repos: repoSummaries,
  });
});

/**
 * GET /api/dashboard/repo/:repoId
 * Full dashboard data for a single repository
 */
const getRepoDashboard = catchAsync(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.repoId, owner: req.user._id });
  if (!repo) return res.status(404).json({ success: false, message: 'Repository not found.' });

  const [analytics, insights] = await Promise.all([
    Analytics.findOne({ repository: repo._id, owner: req.user._id }),
    AIInsights.findOne({ repository: repo._id, owner: req.user._id }),
  ]);

  if (!analytics) {
    return res.status(404).json({
      success: false,
      message: 'No analytics found. Please sync this repository first.',
    });
  }

  // Build commit trend for last 30 days
  const commitsByDate = {};
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  analytics.commits.forEach((c) => {
    if (!c.date || new Date(c.date) < thirtyDaysAgo) return;
    const date = new Date(c.date).toISOString().split('T')[0];
    commitsByDate[date] = (commitsByDate[date] || 0) + 1;
  });

  const commitTrend = Object.entries(commitsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Top 5 contributors
  const topContributors = [...analytics.contributors]
    .sort((a, b) => b.totalCommits - a.totalCommits)
    .slice(0, 5);

  // Recent activity (last 10 commits + last 5 PRs + last 5 issues)
  const recentCommits = analytics.commits
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map((c) => ({ type: 'commit', sha: c.sha?.slice(0, 7), message: c.message?.split('\n')[0]?.slice(0, 80), author: c.author, date: c.date }));

  const recentPRs = analytics.pullRequests
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((p) => ({ type: 'pr', number: p.prNumber, title: p.title?.slice(0, 80), state: p.state, author: p.author, date: p.createdAt }));

  const recentIssues = analytics.issues
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((i) => ({ type: 'issue', number: i.issueNumber, title: i.title?.slice(0, 80), state: i.state, author: i.author, date: i.createdAt }));

  const activityFeed = [...recentCommits, ...recentPRs, ...recentIssues]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  res.json({
    success: true,
    repository: {
      id: repo._id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      url: repo.url,
      language: repo.language,
      stars: repo.stars,
      forks: repo.forks,
      lastSynced: repo.lastSynced,
    },
    metrics: analytics.metrics,
    commitTrend,
    weeklyActivity: analytics.weeklyActivity.slice(-12),
    heatmapData: analytics.heatmapData,
    topContributors,
    activityFeed,
    insights: insights ? {
      sprintSummary: insights.sprintSummary,
      productivityInsights: insights.productivityInsights,
      recommendations: insights.recommendations?.slice(0, 3),
      bottlenecks: insights.bottlenecks,
      riskAnalysis: insights.riskAnalysis,
      generatedAt: insights.generatedAt,
    } : null,
    lastCalculated: analytics.lastCalculated,
  });
});

module.exports = { getDashboardOverview, getRepoDashboard };