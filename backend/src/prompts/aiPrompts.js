/**
 * AI Prompt Engineering System for DevTrackr
 * All prompts are designed for structured, actionable output from Groq.
 */

/**
 * Sprint summary prompt
 * @param {object} analyticsData - repository analytics metrics
 * @returns {string} prompt string
 */
const sprintSummaryPrompt = (analyticsData) => {
  return `
You are a smart senior developer giving quick sprint feedback to your teammate.

Be:
- concise
- friendly
- practical
- encouraging
- human-like

Avoid:
- corporate language
- long explanations
- repeating metrics
- generic AI wording

REPOSITORY DATA:
- Repository: ${analyticsData.repoName}
- Total Commits: ${analyticsData.totalCommits}
- Open PRs: ${analyticsData.openPRs}
- Open Issues: ${analyticsData.openIssues}
- Active Contributors: ${analyticsData.activeContributors}
- Commit Trend: ${analyticsData.weeklyTrend}
- Top Contributor: ${analyticsData.topContributor}

Write:
- 4 to 7 short sentences
- conversational tone
- focus only on important observations
- mention positives first
- if something is weak, say it casually like a mentor

Keep it under 120 words.
`;
};

/**
 * Productivity insights prompt
 */
const productivityInsightsPrompt = (analyticsData) => {
  return `
You are an experienced developer reviewing a teammate's workflow.

Give short, practical productivity insights.

Style:
- concise
- supportive
- realistic
- no corporate jargon
- no overexplaining

METRICS:
- Productivity Score: ${analyticsData.productivityScore}/100
- Health Score: ${analyticsData.healthScore}/100
- Commit Frequency: ${analyticsData.commitFrequency}
- PR Merge Rate: ${analyticsData.prMergeRate}%
- Issue Resolution Rate: ${analyticsData.issueResolutionRate}%

Write:
- max 5 bullet points
- each bullet under 20 words
- focus on actionable insights
- sound like a real engineering mentor
`;
};

/**
 * AI recommendations prompt
 */
const recommendationsPrompt = (analyticsData) => {
  return `You are a senior engineering lead. Based on this repository's analytics, generate 5 specific, actionable recommendations.

DATA SUMMARY:
- Avg PR Merge Time: ${analyticsData.avgPRMergeTime} hours
- Open PRs: ${analyticsData.openPRs}
- Open Issues: ${analyticsData.openIssues}
- Inactive Contributors (14+ days): ${analyticsData.inactiveContributors}
- Commit Frequency: ${analyticsData.commitFrequency} commits/day
- Health Score: ${analyticsData.healthScore}/100
- Productivity Score: ${analyticsData.productivityScore}/100

Return ONLY a valid JSON array (no markdown, no backticks) with exactly 5 objects:
[
  {
    "category": "productivity|code_quality|collaboration|process|risk",
    "priority": "high|medium|low",
    "title": "Short action title",
    "description": "1-2 short practical sentence"
  }
]`;
};

/**
 * Bottleneck detection prompt
 */
const bottleneckDetectionPrompt = (analyticsData) => {
  return `You are a DevOps engineer and process analyst. Identify development bottlenecks from this data.

REPOSITORY METRICS:
- Avg PR Review Time: ${analyticsData.avgPRMergeTime} hours (industry benchmark: 24 hours)
- Open PRs sitting >48h: ${analyticsData.stalePRs}
- Open Issues >7 days old: ${analyticsData.staleIssues}
- Contributors with 0 commits in 14 days: ${analyticsData.inactiveContributors}
- Commit frequency trend: ${analyticsData.commitTrend} (increasing/decreasing/stable)
- PR review participation: ${analyticsData.prReviewParticipation}%
- Issue assignment rate: ${analyticsData.issueAssignmentRate}%

Return ONLY a valid JSON array (no markdown, no backticks) of bottlenecks found:
[
  {
    "type": "bottleneck type",
    "severity": "critical|high|medium|low",
    "description": "specific description of the bottleneck",
    "affectedArea": "PRs|Issues|Contributors|Commits|Reviews",
    "suggestion": "specific fix suggestion"
  }
]

If no significant bottlenecks, return an empty array [].`;
};

/**
 * Project health analysis prompt
 */
const projectHealthPrompt = (analyticsData) => {
  return `
You are a senior developer reviewing the overall health of a project.

Be honest, concise, and friendly.

PROJECT DATA:
- Health Score: ${analyticsData.healthScore}/100
- Productivity Score: ${analyticsData.productivityScore}/100
- Contributors: ${analyticsData.totalContributors}
- Active Contributors: ${analyticsData.activeContributors}
- PR Merge Rate: ${analyticsData.prMergeRate}%

Write:
- 1 short paragraph
- under 80 words
- focus only on the most important health observations
- give practical encouragement if needed
`;
};

/**
 * Risk analysis prompt
 */
const riskAnalysisPrompt = (analyticsData) => {
  return `You are a risk assessment specialist for software projects. Identify and categorize project risks.

DATA:
- Inactive contributors ratio: ${analyticsData.inactiveRatio}%
- Stale PRs: ${analyticsData.stalePRs}
- Long-open issues: ${analyticsData.staleIssues}
- Days since last commit: ${analyticsData.daysSinceLastCommit}
- Single contributor dominance: ${analyticsData.topContributorShare}% of commits
- Health score: ${analyticsData.healthScore}/100

Return ONLY valid JSON (no markdown, no backticks):
{
  "overallRisk": "low|medium|high|critical",
  "risks": [
    {
      "area": "risk area name",
      "level": "low|medium|high|critical",
      "description": "specific risk description"
    }
  ]
}`;
};

/**
 * Inactive contributor analysis prompt
 */
const inactiveContributorPrompt = (contributors) => {
  const list = contributors.map(c => `${c.login}: last active ${c.lastActiveDate}, ${c.totalCommits} total commits`).join('\n');
  
  return `You are a team leads and HR advisor for engineering teams. Analyze these inactive contributors.

INACTIVE CONTRIBUTORS (no commits in 14+ days):
${list}

Return ONLY a valid JSON array (no markdown, no backticks):
[
  {
    "login": "github username",
    "lastActive": "date string",
    "daysSinceActive": number,
    "suggestion": "specific 1-sentence action suggestion for this contributor"
  }
]`;
};

module.exports = {
  sprintSummaryPrompt,
  productivityInsightsPrompt,
  recommendationsPrompt,
  bottleneckDetectionPrompt,
  projectHealthPrompt,
  riskAnalysisPrompt,
  inactiveContributorPrompt,
};