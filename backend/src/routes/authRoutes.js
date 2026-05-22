const express = require('express');
const { register, login, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { registerValidators, loginValidators } = require('../validators/authValidators');

const router = express.Router();

router.post('/register', registerValidators, register);
router.post('/login', loginValidators, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;