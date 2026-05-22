import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s timeout (AI generation can be slow)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: attach JWT token ─────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('devtrackr_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle auth errors globally ─────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect
      localStorage.removeItem('devtrackr_token');
      localStorage.removeItem('devtrackr_user');
      // Only redirect if not already on auth pages
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// ─── GitHub API ───────────────────────────────────────────────────────────
export const githubAPI = {
  connect: (token) => api.post('/github/connect', { token }),
  getRepos: () => api.get('/github/repos'),
  getTrackedRepos: () => api.get('/github/repos/tracked'),
  trackRepo: (repoData) => api.post('/github/repos/track', repoData),
  untrackRepo: (repoId) => api.delete(`/github/repos/${repoId}`),
  syncRepo: (repoId) => api.post(`/github/sync/${repoId}`),
};

// ─── Analytics API ────────────────────────────────────────────────────────
export const analyticsAPI = {
  getAnalytics: (repoId) => api.get(`/analytics/${repoId}`),
  getMetrics: (repoId) => api.get(`/analytics/${repoId}/metrics`),
  getCommits: (repoId) => api.get(`/analytics/${repoId}/commits`),
  getPRs: (repoId) => api.get(`/analytics/${repoId}/prs`),
  getIssues: (repoId) => api.get(`/analytics/${repoId}/issues`),
  getContributors: (repoId) => api.get(`/analytics/${repoId}/contributors`),
};

// ─── AI API ───────────────────────────────────────────────────────────────
export const aiAPI = {
  generateInsights: (repoId, force = false) =>
    api.post(`/ai/generate/${repoId}${force ? '?force=true' : ''}`),
  getInsights: (repoId) => api.get(`/ai/insights/${repoId}`),
  getRecommendations: (repoId) => api.get(`/ai/insights/${repoId}/recommendations`),
  getBottlenecks: (repoId) => api.get(`/ai/insights/${repoId}/bottlenecks`),
};

// ─── Dashboard API ────────────────────────────────────────────────────────
export const dashboardAPI = {
  getOverview: () => api.get('/dashboard/overview'),
  getRepoDashboard: (repoId) => api.get(`/dashboard/repo/${repoId}`),
};

export default api;