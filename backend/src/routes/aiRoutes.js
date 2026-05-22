const express = require('express');
const { generateInsights, getInsights, getRecommendations, getBottlenecks } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/generate/:repoId', generateInsights);
router.get('/insights/:repoId', getInsights);
router.get('/insights/:repoId/recommendations', getRecommendations);
router.get('/insights/:repoId/bottlenecks', getBottlenecks);

module.exports = router;