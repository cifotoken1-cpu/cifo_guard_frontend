/**
 * Authentication Routes
 * Handles login, logout, password management, and user profile
 */

const express = require('express');
const AuthController = require('../controllers/AuthController');
const { verifyToken } = require('../middleware/auth-config');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  await AuthController.login(req, res);
});

/**
 * POST /api/auth/logout
 * Logout current user
 * Requires: Valid JWT token
 */
router.post('/logout', verifyToken, async (req, res) => {
  await AuthController.logout(req, res);
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Requires: Valid JWT token
 */
router.get('/me', verifyToken, async (req, res) => {
  await AuthController.getCurrentUser(req, res);
});

/**
 * PUT /api/auth/change-password
 * Change password for current user
 * Requires: Valid JWT token
 * Body: { current_password, new_password }
 */
router.put('/change-password', verifyToken, async (req, res) => {
  await AuthController.changePassword(req, res);
});

/**
 * POST /api/auth/reset-password
 * Request password reset token (admin-driven)
 * Body: { email }
 */
router.post('/reset-password', async (req, res) => {
  await AuthController.requestPasswordReset(req, res);
});

/**
 * POST /api/auth/reset-password/confirm
 * Confirm password reset with token
 * Body: { token, new_password }
 */
router.post('/reset-password/confirm', async (req, res) => {
  await AuthController.confirmPasswordReset(req, res);
});

module.exports = router;
