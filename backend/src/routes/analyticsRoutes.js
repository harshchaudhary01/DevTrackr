const express = require('express');
const {
  getAnalytics,
  getMetrics,
  getCommitAnalytics,
  getPRAnalytics,
  getIssueAnalytics,
  getContributorAnalytics,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/:repoId', getAnalytics);
router.get('/:repoId/metrics', getMetrics);
router.get('/:repoId/commits', getCommitAnalytics);
router.get('/:repoId/prs', getPRAnalytics);
router.get('/:repoId/issues', getIssueAnalytics);
router.get('/:repoId/contributors', getContributorAnalytics);

module.exports = router;