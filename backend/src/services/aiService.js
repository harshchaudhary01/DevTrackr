const { GoogleGenAI } = require('@google/genai');
const {
  sprintSummaryPrompt,
  productivityInsightsPrompt,
  recommendationsPrompt,
  bottleneckDetectionPrompt,
  projectHealthPrompt,
  riskAnalysisPrompt,
  inactiveContributorPrompt,
} = require('../prompts/aiPrompts');

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-2.0-flash';

/**
 * Core Gemini text generation function
 * @param {string} prompt
 * @returns {string} response text
 */
const generateText = async (prompt) => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    throw new Error(`AI generation failed: ${error.message}`);
  }
};

/**
 * Safely parse JSON from Gemini response
 * Gemini sometimes wraps JSON in markdown code blocks
 * @param {string} text
 * @returns {any} parsed JSON
 */
const safeParseJSON = (text) => {
  try {
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    console.error('JSON parse failed for AI response:', text);
    return null;
  }
};

/**
 * Generate sprint summary
 */
const generateSprintSummary = async (analyticsData) => {
  const prompt = sprintSummaryPrompt(analyticsData);
  const text = await generateText(prompt);
  return text;
};

/**
 * Generate productivity insights
 */
const generateProductivityInsights = async (analyticsData) => {
  const prompt = productivityInsightsPrompt(analyticsData);
  const text = await generateText(prompt);
  return text;
};

/**
 * Generate actionable recommendations
 * Returns array of recommendation objects
 */
const generateRecommendations = async (analyticsData) => {
  const prompt = recommendationsPrompt(analyticsData);
  const text = await generateText(prompt);
  const parsed = safeParseJSON(text);

  if (!Array.isArray(parsed)) {
    // Fallback if parsing fails
    return [
      {
        category: 'process',
        priority: 'medium',
        title: 'Review Development Process',
        description: 'Consider reviewing and optimizing your current development workflow for better efficiency.',
      },
    ];
  }

  return parsed;
};

/**
 * Detect bottlenecks in development process
 * Returns array of bottleneck objects
 */
const detectBottlenecks = async (analyticsData) => {
  const prompt = bottleneckDetectionPrompt(analyticsData);
  const text = await generateText(prompt);
  const parsed = safeParseJSON(text);

  if (!Array.isArray(parsed)) return [];
  return parsed;
};

/**
 * Generate project health analysis
 */
const generateProjectHealthAnalysis = async (analyticsData) => {
  const prompt = projectHealthPrompt(analyticsData);
  const text = await generateText(prompt);
  return text;
};

/**
 * Generate risk analysis
 * Returns object with overallRisk and risks array
 */
const generateRiskAnalysis = async (analyticsData) => {
  const prompt = riskAnalysisPrompt(analyticsData);
  const text = await generateText(prompt);
  const parsed = safeParseJSON(text);

  if (!parsed || !parsed.overallRisk) {
    return { overallRisk: 'low', risks: [] };
  }

  return parsed;
};

/**
 * Analyze inactive contributors
 */
const analyzeInactiveContributors = async (contributors) => {
  if (!contributors || contributors.length === 0) return [];

  const prompt = inactiveContributorPrompt(contributors);
  const text = await generateText(prompt);
  const parsed = safeParseJSON(text);

  if (!Array.isArray(parsed)) return [];
  return parsed;
};

module.exports = {
  generateSprintSummary,
  generateProductivityInsights,
  generateRecommendations,
  detectBottlenecks,
  generateProjectHealthAnalysis,
  generateRiskAnalysis,
  analyzeInactiveContributors,
};