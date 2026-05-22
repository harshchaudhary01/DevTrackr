const express = require('express');
const {
  connectGithub,
  getRepositories,
  trackRepository,
  untrackRepository,
  getTrackedRepositories,
  syncRepository,
} = require('../controllers/githubController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All GitHub routes require authentication
router.use(protect);

router.post('/connect', connectGithub);
router.get('/repos', getRepositories);
router.get('/repos/tracked', getTrackedRepositories);
router.post('/repos/track', trackRepository);
router.delete('/repos/:repoId', untrackRepository);
router.post('/sync/:repoId', syncRepository);

module.exports = router;