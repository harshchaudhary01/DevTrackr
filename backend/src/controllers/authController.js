const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../utils/jwtUtils');
const { catchAsync, AppError } = require('../middleware/errorMiddleware');

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { name, email, password } = req.body;

  // Check if email already exists
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already in use.' });
  }

  // Create user (password hashed in model pre-save hook)
  const user = await User.create({ name, email, password });

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      githubUsername: user.githubUsername,
      githubAvatar: user.githubAvatar,
      plan: user.plan,
    },
  });
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
const login = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  // Update last active
  await user.updateActivity();

  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Login successful!',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      githubUsername: user.githubUsername,
      githubAvatar: user.githubAvatar,
      plan: user.plan,
    },
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
const getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      githubUsername: user.githubUsername,
      githubAvatar: user.githubAvatar,
      plan: user.plan,
      lastActive: user.lastActive,
      createdAt: user.createdAt,
    },
  });
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
const updateProfile = catchAsync(async (req, res) => {
  const { name } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name },
    { new: true, runValidators: true }
  );

  res.json({ success: true, message: 'Profile updated.', user: { id: user._id, name: user.name, email: user.email } });
});

module.exports = { register, login, getMe, updateProfile };