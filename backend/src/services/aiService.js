const Groq = require('groq-sdk');

const {
  sprintSummaryPrompt,
  productivityInsightsPrompt,
  recommendationsPrompt,
  bottleneckDetectionPrompt,
  projectHealthPrompt,
  riskAnalysisPrompt,
  inactiveContributorPrompt,
} = require('../prompts/aiPrompts');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Recommended Groq model
const MODEL = 'llama-3.3-70b-versatile';

class AIServiceError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'AIServiceError';
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'AI_SERVICE_ERROR';
    this.retryAfterSeconds = options.retryAfterSeconds || null;
  }
}

const extractRetryAfterSeconds = (message) => {
  const match = String(message || '').match(
    /retry in\s+(\d+(?:\.\d+)?)s/i
  );

  return match ? Math.ceil(Number(match[1])) : null;
};

const normalizeAIError = (error) => {
  const message = String(
    error?.message || error || 'Unknown AI error'
  );

  const upper = message.toUpperCase();

  const retryAfterSeconds =
    extractRetryAfterSeconds(message);

  // Rate limit / quota
  if (
    upper.includes('RATE_LIMIT') ||
    message.includes('429') ||
    /quota exceeded/i.test(message)
  ) {
    return new AIServiceError(
      'Groq API quota exceeded. Please try again later.',
      {
        statusCode: 429,
        code: 'AI_QUOTA_EXCEEDED',
        retryAfterSeconds,
      }
    );
  }

  // Authentication issues
  if (
    upper.includes('UNAUTHORIZED') ||
    upper.includes('INVALID API KEY')
  ) {
    return new AIServiceError(
      'Invalid Groq API key.',
      {
        statusCode: 401,
        code: 'INVALID_API_KEY',
      }
    );
  }

  return new AIServiceError(
    `AI generation failed: ${message}`,
    {
      statusCode: 502,
      code: 'AI_GENERATION_FAILED',
      retryAfterSeconds,
    }
  );
};

/**
 * Core text generation function
 * @param {string} prompt
 * @returns {string}
 */
const generateText = async (prompt) => {
  try {
    const completion =
      await groq.chat.completions.create({
        model: MODEL,

        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],

        temperature: 0.3,

        // Helps keep responses concise
        max_tokens: 2000,
      });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error(
      'Groq API Error:',
      error.message
    );

    throw normalizeAIError(error);
  }
};

/**
 * Safely parse JSON from AI response
 */
const safeParseJSON = (text) => {
  try {
    const cleaned = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    return JSON.parse(cleaned);
  } catch {
    console.error(
      'JSON parse failed for AI response:',
      text
    );

    return null;
  }
};

/**
 * Generate sprint summary
 */
const generateSprintSummary = async (
  analyticsData
) => {
  const prompt =
    sprintSummaryPrompt(analyticsData);

  return await generateText(prompt);
};

/**
 * Generate productivity insights
 */
const generateProductivityInsights =
  async (analyticsData) => {
    const prompt =
      productivityInsightsPrompt(
        analyticsData
      );

    return await generateText(prompt);
  };

/**
 * Generate actionable recommendations
 */
const generateRecommendations = async (
  analyticsData
) => {
  const prompt =
    recommendationsPrompt(analyticsData);

  const text = await generateText(prompt);

  const parsed = safeParseJSON(text);

  if (!Array.isArray(parsed)) {
    return [
      {
        category: 'process',
        priority: 'medium',
        title: 'Review Development Process',
        description:
          'Consider reviewing and optimizing your workflow.',
      },
    ];
  }

  return parsed;
};

/**
 * Detect bottlenecks
 */
const detectBottlenecks = async (
  analyticsData
) => {
  const prompt =
    bottleneckDetectionPrompt(
      analyticsData
    );

  const text = await generateText(prompt);

  const parsed = safeParseJSON(text);

  if (!Array.isArray(parsed)) return [];

  return parsed;
};

/**
 * Project health analysis
 */
const generateProjectHealthAnalysis =
  async (analyticsData) => {
    const prompt =
      projectHealthPrompt(
        analyticsData
      );

    return await generateText(prompt);
  };

/**
 * Risk analysis
 */
const generateRiskAnalysis = async (
  analyticsData
) => {
  const prompt =
    riskAnalysisPrompt(analyticsData);

  const text = await generateText(prompt);

  const parsed = safeParseJSON(text);

  if (!parsed || !parsed.overallRisk) {
    return {
      overallRisk: 'low',
      risks: [],
    };
  }

  return parsed;
};

/**
 * Analyze inactive contributors
 */
const analyzeInactiveContributors =
  async (contributors) => {
    if (
      !contributors ||
      contributors.length === 0
    ) {
      return [];
    }

    const prompt =
      inactiveContributorPrompt(
        contributors
      );

    const text = await generateText(prompt);

    const parsed = safeParseJSON(text);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  };

module.exports = {
  AIServiceError,
  generateSprintSummary,
  generateProductivityInsights,
  generateRecommendations,
  detectBottlenecks,
  generateProjectHealthAnalysis,
  generateRiskAnalysis,
  analyzeInactiveContributors,
};