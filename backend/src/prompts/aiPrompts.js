/**
 * AI Prompt Engineering System for DevTrackr
 * All prompts are designed for structured, actionable output from Gemini.
 */

/**
 * Sprint summary prompt
 * @param {object} analyticsData - repository analytics metrics
 * @returns {string} prompt string
 */
const sprintSummaryPrompt = (analyticsData) => {
  return `You are an expert software engineering analyst. Analyze the following developer activity data and generate a concise, insightful sprint summary.

REPOSITORY DATA:
- Repository: ${analyticsData.repoName}
- Total Commits (last 30 days): ${analyticsData.totalCommits}
- Total Pull Requests: ${analyticsData.totalPRs} (Open: ${analyticsData.openPRs}, Merged: ${analyticsData.mergedPRs})
- Total Issues: ${analyticsData.totalIssues} (Open: ${analyticsData.openIssues}, Closed: ${analyticsData.closedIssues})
- Active Contributors: ${analyticsData.activeContributors}
- Average PR Merge Time: ${analyticsData.avgPRMergeTime} hours
- Code Changes: +${analyticsData.totalAdditions} additions, -${analyticsData.totalDeletions} deletions
- Top Contributor: ${analyticsData.topContributor}
- Weekly Commit Trend: ${analyticsData.weeklyTrend}

Generate a 3-4 paragraph sprint summary that covers:
1. Overall sprint performance and velocity
2. Key accomplishments and code quality observations
3. Team collaboration effectiveness
4. Sprint highlights and momentum

Be specific, data-driven, and motivating. Use developer-friendly language. Keep it under 300 words.`;
};

/**
 * Productivity insights prompt
 */
const productivityInsightsPrompt = (analyticsData) => {
  return `You are a developer productivity expert. Analyze this team's development metrics and provide deep productivity insights.

METRICS:
- Productivity Score: ${analyticsData.productivityScore}/100
- Health Score: ${analyticsData.healthScore}/100
- Commit Frequency: ${analyticsData.commitFrequency} commits/day
- PR Merge Rate: ${analyticsData.prMergeRate}%
- Issue Resolution Rate: ${analyticsData.issueResolutionRate}%
- Avg Issue Resolution Time: ${analyticsData.avgIssueResolutionTime} hours
- Inactive Contributors: ${analyticsData.inactiveContributors}
- Total Contributors: ${analyticsData.totalContributors}
- Code Churn (deletions/additions ratio): ${analyticsData.codeChurn}

Provide detailed productivity insights covering:
1. What the team is doing well
2. Areas where productivity is being affected
3. Specific bottlenecks identified in the data
4. Team collaboration patterns

Keep it analytical, specific, and under 250 words.`;
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
    "description": "2-3 sentence specific recommendation"
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
  return `You are a technical project manager and code quality expert. Analyze this project's overall health.

PROJECT DATA:
- Repository: ${analyticsData.repoName}
- Health Score: ${analyticsData.healthScore}/100
- Productivity Score: ${analyticsData.productivityScore}/100
- Stars: ${analyticsData.stars} | Forks: ${analyticsData.forks}
- Language: ${analyticsData.language}
- Total Contributors: ${analyticsData.totalContributors}
- Active in last 30 days: ${analyticsData.activeContributors}
- PR merge success rate: ${analyticsData.prMergeRate}%
- Issue close rate: ${analyticsData.issueResolutionRate}%
- Avg PR merge time: ${analyticsData.avgPRMergeTime}h
- Code additions/deletions ratio: ${analyticsData.codeRatio}

Write a comprehensive 2-3 paragraph project health analysis covering:
1. Project vitality and community engagement
2. Code quality and development pace indicators  
3. Risk factors and sustainability assessment

Be honest, specific, and constructive. Under 200 words.`;
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