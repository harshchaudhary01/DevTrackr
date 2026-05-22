const express = require('express');
const { getDashboardOverview, getRepoDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/overview', getDashboardOverview);
router.get('/repo/:repoId', getRepoDashboard);

module.exports = router;