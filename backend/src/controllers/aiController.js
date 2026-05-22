const Analytics = require('../models/Analytics');
const AIInsights = require('../models/AIInsights');
const Repository = require('../models/Repository');
const aiService = require('../services/aiService');
const { buildAIDataPayload } = require('../analytics/analyticsEngine');
const { catchAsync } = require('../middleware/errorMiddleware');

/**
 * POST /api/ai/generate/:repoId
 * Generate all AI insights for a repository (or return cached)
 */
const generateInsights = catchAsync(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.repoId, owner: req.user._id });
  if (!repo) return res.status(404).json({ success: false, message: 'Repository not found.' });

  const analytics = await Analytics.findOne({ repository: repo._id, owner: req.user._id });
  if (!analytics) {
    return res.status(400).json({ success: false, message: 'Please sync the repository before generating AI insights.' });
  }

  // Check cache - if insights exist and not expired, return cached
  const existing = await AIInsights.findOne({ repository: repo._id, owner: req.user._id });
  const forceRegenerate = req.query.force === 'true';

  if (existing && !forceRegenerate && existing.expiresAt > new Date()) {
    return res.json({ success: true, cached: true, insights: existing });
  }

  // Build data payload for AI
  const aiData = buildAIDataPayload(repo.name, {
    commits: analytics.commits,
    pullRequests: analytics.pullRequests,
    issues: analytics.issues,
    contributors: analytics.contributors,
    repo: {
      stars: repo.stars,
      forks: repo.forks,
      language: repo.language,
    },
  }, analytics.metrics);

  // Find inactive contributors for detailed analysis
  const inactiveContributors = analytics.contributors
    .filter((c) => c.isInactive)
    .map((c) => ({
      login: c.login,
      lastActiveDate: c.lastActiveDate ? c.lastActiveDate.toISOString().split('T')[0] : 'Unknown',
      totalCommits: c.totalCommits,
    }));

  // Generate all AI insights in parallel
  const [
    sprintSummary,
    productivityInsights,
    recommendations,
    bottlenecks,
    projectHealthAnalysis,
    riskAnalysis,
    inactiveAnalysis,
  ] = await Promise.allSettled([
    aiService.generateSprintSummary(aiData),
    aiService.generateProductivityInsights(aiData),
    aiService.generateRecommendations(aiData),
    aiService.detectBottlenecks(aiData),
    aiService.generateProjectHealthAnalysis(aiData),
    aiService.generateRiskAnalysis(aiData),
    aiService.analyzeInactiveContributors(inactiveContributors),
  ]);

  const aiResults = [
    sprintSummary,
    productivityInsights,
    recommendations,
    bottlenecks,
    projectHealthAnalysis,
    riskAnalysis,
    inactiveAnalysis,
  ];
  const failedResults = aiResults.filter((result) => result.status === 'rejected');
  const quotaFailure = failedResults.find((result) => result.reason?.code === 'AI_QUOTA_EXCEEDED');

  if (failedResults.length === aiResults.length) {
    const statusCode = quotaFailure?.reason?.statusCode || 503;

    if (quotaFailure?.reason?.retryAfterSeconds) {
      res.set('Retry-After', String(quotaFailure.reason.retryAfterSeconds));
    }

    return res.status(statusCode).json({
      success: false,
      message: quotaFailure?.reason?.message || 'AI insight generation failed for every task. Please try again later.',
    });
  }

  // Build insights object with fallbacks
  const insightsData = {
    repository: repo._id,
    owner: req.user._id,
    sprintSummary: sprintSummary.status === 'fulfilled' ? sprintSummary.value : 'Sprint summary generation failed. Please try again.',
    productivityInsights: productivityInsights.status === 'fulfilled' ? productivityInsights.value : 'Productivity insights unavailable.',
    recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
    bottlenecks: bottlenecks.status === 'fulfilled' ? bottlenecks.value : [],
    projectHealthAnalysis: projectHealthAnalysis.status === 'fulfilled' ? projectHealthAnalysis.value : 'Health analysis unavailable.',
    riskAnalysis: riskAnalysis.status === 'fulfilled' ? riskAnalysis.value : { overallRisk: 'low', risks: [] },
    inactiveContributors: inactiveAnalysis.status === 'fulfilled' ? inactiveAnalysis.value : [],
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6-hour cache
  };

  // Upsert insights
  const insights = await AIInsights.findOneAndUpdate(
    { repository: repo._id, owner: req.user._id },
    insightsData,
    { upsert: true, returnDocument: 'after' }
  );

  if (quotaFailure?.reason?.retryAfterSeconds) {
    res.set('Retry-After', String(quotaFailure.reason.retryAfterSeconds));
  }

  res.json({
    success: true,
    cached: false,
    partial: failedResults.length > 0,
    warnings: failedResults.map((result) => result.reason?.message).filter(Boolean),
    insights,
  });
});

/**
 * GET /api/ai/insights/:repoId
 * Get cached AI insights for a repository
 */
const getInsights = catchAsync(async (req, res) => {
  const insights = await AIInsights.findOne({
    repository: req.params.repoId,
    owner: req.user._id,
  });

  if (!insights) {
    return res.status(404).json({
      success: false,
      message: 'No AI insights found. Generate insights first.',
    });
  }

  res.json({ success: true, insights });
});

/**
 * GET /api/ai/insights/:repoId/recommendations
 * Get only recommendations
 */
const getRecommendations = catchAsync(async (req, res) => {
  const insights = await AIInsights.findOne(
    { repository: req.params.repoId, owner: req.user._id },
    'recommendations generatedAt'
  );

  if (!insights) return res.status(404).json({ success: false, message: 'No insights found.' });

  res.json({ success: true, recommendations: insights.recommendations, generatedAt: insights.generatedAt });
});

/**
 * GET /api/ai/insights/:repoId/bottlenecks
 * Get detected bottlenecks
 */
const getBottlenecks = catchAsync(async (req, res) => {
  const insights = await AIInsights.findOne(
    { repository: req.params.repoId, owner: req.user._id },
    'bottlenecks generatedAt'
  );

  if (!insights) return res.status(404).json({ success: false, message: 'No insights found.' });

  res.json({ success: true, bottlenecks: insights.bottlenecks, generatedAt: insights.generatedAt });
});

module.exports = { generateInsights, getInsights, getRecommendations, getBottlenecks };
