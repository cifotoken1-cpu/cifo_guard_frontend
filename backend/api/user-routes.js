/**
 * User Management Routes
 * CRUD operations for users (admin only)
 */

const express = require('express');
const UserController = require('../controllers/UserController');
const { verifyToken, requireRole } = require('../middleware/auth-config');

const router = express.Router();

/**
 * POST /api/users
 * Create new user
 * Requires: Valid JWT token + ADMIN or SUPER_ADMIN role
 * Body: { username, email, name, password, role?, team_member_id? }
 */
router.post('/', verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  await UserController.createUser(req, res);
});

/**
 * GET /api/users
 * List all users with filters
 * Requires: Valid JWT token + ADMIN or SUPER_ADMIN role
 * Query: role?, account_status?, limit?, offset?
 */
router.get('/', verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  await UserController.listUsers(req, res);
});

/**
 * GET /api/users/:id
 * Get user details
 * Requires: Valid JWT token + ADMIN or SUPER_ADMIN role
 */
router.get('/:id', verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  await UserController.getUserById(req, res);
});

/**
 * PUT /api/users/:id
 * Update user info
 * Requires: Valid JWT token + ADMIN or SUPER_ADMIN role
 * Body: { email?, name?, role?, team_member_id? }
 */
router.put('/:id', verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  await UserController.updateUser(req, res);
});

/**
 * DELETE /api/users/:id
 * Delete user (soft delete - set to INACTIVE)
 * Requires: Valid JWT token + SUPER_ADMIN role
 */
router.delete('/:id', verifyToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  await UserController.deleteUser(req, res);
});

/**
 * PATCH /api/users/:id/role
 * Change user role
 * Requires: Valid JWT token + SUPER_ADMIN role
 * Body: { role }
 */
router.patch('/:id/role', verifyToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  await UserController.changeUserRole(req, res);
});

/**
 * POST /api/users/:id/unlock
 * Unlock locked user account
 * Requires: Valid JWT token + ADMIN or SUPER_ADMIN role
 */
router.post('/:id/unlock', verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  await UserController.unlockUser(req, res);
});

module.exports = router;
