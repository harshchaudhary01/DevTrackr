const mongoose = require('mongoose');

const commitDataSchema = new mongoose.Schema({
  sha: String,
  message: String,
  author: String,
  authorEmail: String,
  date: Date,
  additions: { type: Number, default: 0 },
  deletions: { type: Number, default: 0 },
  filesChanged: { type: Number, default: 0 },
}, { _id: false });

const pullRequestSchema = new mongoose.Schema({
  prNumber: Number,
  title: String,
  state: { type: String, enum: ['open', 'closed', 'merged'] },
  author: String,
  createdAt: Date,
  closedAt: Date,
  mergedAt: Date,
  mergeTimeHours: Number, // time from open to merge
  reviewCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
}, { _id: false });

const issueSchema = new mongoose.Schema({
  issueNumber: Number,
  title: String,
  state: { type: String, enum: ['open', 'closed'] },
  author: String,
  labels: [String],
  createdAt: Date,
  closedAt: Date,
  resolutionTimeHours: Number,
  commentCount: { type: Number, default: 0 },
}, { _id: false });

const contributorSchema = new mongoose.Schema({
  login: String,
  avatarUrl: String,
  totalCommits: { type: Number, default: 0 },
  totalAdditions: { type: Number, default: 0 },
  totalDeletions: { type: Number, default: 0 },
  totalPRs: { type: Number, default: 0 },
  lastActiveDate: Date,
  isInactive: { type: Boolean, default: false }, // inactive for 14+ days
  weeklyCommits: [Number], // last 8 weeks
}, { _id: false });

const weeklyActivitySchema = new mongoose.Schema({
  week: String, // ISO week string e.g. "2024-W01"
  commits: { type: Number, default: 0 },
  prsOpened: { type: Number, default: 0 },
  prsMerged: { type: Number, default: 0 },
  issuesOpened: { type: Number, default: 0 },
  issuesClosed: { type: Number, default: 0 },
  additions: { type: Number, default: 0 },
  deletions: { type: Number, default: 0 },
}, { _id: false });

const analyticsSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Raw data
    commits: [commitDataSchema],
    pullRequests: [pullRequestSchema],
    issues: [issueSchema],
    contributors: [contributorSchema],
    weeklyActivity: [weeklyActivitySchema],

    // Aggregated metrics
    metrics: {
      totalCommits: { type: Number, default: 0 },
      totalPRs: { type: Number, default: 0 },
      totalIssues: { type: Number, default: 0 },
      totalContributors: { type: Number, default: 0 },
      avgPRMergeTimeHours: { type: Number, default: 0 },
      avgIssueResolutionTimeHours: { type: Number, default: 0 },
      commitFrequencyPerDay: { type: Number, default: 0 },
      openPRCount: { type: Number, default: 0 },
      closedPRCount: { type: Number, default: 0 },
      openIssueCount: { type: Number, default: 0 },
      closedIssueCount: { type: Number, default: 0 },
      inactiveContributors: { type: Number, default: 0 },
      totalAdditions: { type: Number, default: 0 },
      totalDeletions: { type: Number, default: 0 },
      // Productivity score (0-100)
      productivityScore: { type: Number, default: 0 },
      // Project health score (0-100)
      healthScore: { type: Number, default: 0 },
    },

    // Heatmap data (contributions per day for last 365 days)
    heatmapData: [
      {
        date: String, // YYYY-MM-DD
        count: { type: Number, default: 0 },
      },
    ],

    lastCalculated: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookups
analyticsSchema.index({ repository: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);