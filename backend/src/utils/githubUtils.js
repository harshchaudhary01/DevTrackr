const axios = require('axios');

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Create a configured GitHub API axios instance with proper headers
 * @param {string} token - GitHub personal access token
 * @returns {AxiosInstance}
 */
const createGithubClient = (token) => {
  return axios.create({
    baseURL: GITHUB_API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    timeout: 15000,
  });
};

/**
 * Handle GitHub API pagination - fetches ALL pages
 * @param {AxiosInstance} client
 * @param {string} url
 * @param {object} params
 * @param {number} maxPages - max pages to fetch (prevent infinite loops)
 * @returns {Array} all results
 */
const fetchAllPages = async (client, url, params = {}, maxPages = 10) => {
  let allData = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    try {
      const response = await client.get(url, {
        params: { ...params, per_page: 100, page },
      });

      const data = response.data;

      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        // Check if there's a next page via Link header
        const linkHeader = response.headers['link'];
        hasMore = linkHeader ? linkHeader.includes('rel="next"') : data.length === 100;
        page++;
      }
    } catch (error) {
      // Handle rate limit errors
      if (error.response?.status === 403 || error.response?.status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        throw new Error(`GitHub API rate limit exceeded. Resets at ${new Date(resetTime * 1000).toISOString()}`);
      }
      throw error;
    }
  }

  return allData;
};

/**
 * Check remaining GitHub API rate limit
 * @param {AxiosInstance} client
 * @returns {object} rate limit info
 */
const checkRateLimit = async (client) => {
  const response = await client.get('/rate_limit');
  return response.data.rate;
};

/**
 * Format date to YYYY-MM-DD string
 * @param {Date|string} date
 * @returns {string}
 */
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Calculate hours between two dates
 * @param {Date|string} start
 * @param {Date|string} end
 * @returns {number}
 */
const hoursBetween = (start, end) => {
  if (!start || !end) return 0;
  return Math.abs(new Date(end) - new Date(start)) / (1000 * 60 * 60);
};

/**
 * Get ISO week string like "2024-W01"
 * @param {Date} date
 * @returns {string}
 */
const getISOWeek = (date) => {
  const d = new Date(date);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

module.exports = {
  createGithubClient,
  fetchAllPages,
  checkRateLimit,
  formatDate,
  hoursBetween,
  getISOWeek,
};