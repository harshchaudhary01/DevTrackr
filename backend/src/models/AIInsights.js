const mongoose = require('mongoose');

const aiInsightsSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sprintSummary: {
      type: String,
      default: '',
    },
    productivityInsights: {
      type: String,
      default: '',
    },
    recommendations: [
      {
        category: { type: String, enum: ['productivity', 'code_quality', 'collaboration', 'process', 'risk'] },
        priority: { type: String, enum: ['high', 'medium', 'low'] },
        title: String,
        description: String,
      },
    ],
    bottlenecks: [
      {
        type: { type: String },
        severity: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
        description: String,
        affectedArea: String,
        suggestion: String,
      },
    ],
    inactiveContributors: [
      {
        login: String,
        lastActive: String,
        daysSinceActive: Number,
        suggestion: String,
      },
    ],
    projectHealthAnalysis: {
      type: String,
      default: '',
    },
    riskAnalysis: {
      overallRisk: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
      risks: [
        {
          area: String,
          level: String,
          description: String,
        },
      ],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    // Cache validity - regenerate after 6 hours
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
);

aiInsightsSchema.index({ repository: 1, owner: 1 });

module.exports = mongoose.model('AIInsights', aiInsightsSchema);