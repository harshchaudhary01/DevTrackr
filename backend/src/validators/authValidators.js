const { body } = require('express-validator');

const registerValidators = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters.'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address.'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters.'),
];

const loginValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

module.exports = { registerValidators, loginValidators };