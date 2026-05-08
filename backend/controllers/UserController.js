/**
 * User Controller
 * Handles user management CRUD operations (admin only)
 */

const User = require('../models/User');

// Try to import SecurityActivity for audit logging
let SecurityActivity;
try {
  SecurityActivity = require('../models/SecurityActivity');
} catch (e) {
  console.warn('[UserController] SecurityActivity model not available, audit logging disabled');
}

/**
 * Log security activity if model is available
 * @param {Object} activityData
 */
async function logActivity(activityData) {
  if (SecurityActivity) {
    try {
      await SecurityActivity.create(activityData);
    } catch (err) {
      console.error('[UserController] Failed to log activity:', err.message);
    }
  }
}

class UserController {
  /**
   * POST /api/users
   * Create new user (ADMIN or SUPER_ADMIN only)
   * Body: { username, email, name, password, role }
   */
  static async createUser(req, res) {
    try {
      const { username, email, name, password, role, team_member_id } = req.body;

      // Validate required fields
      if (!username || !email || !name || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: username, email, name, password'
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      // Validate role
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'GUARD', 'VIEWER'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Check if username already exists
      const existingUsername = await User.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }

      // Check if email already exists
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }

      // Create user
      const newUser = await User.create({
        username,
        email,
        name,
        password,
        role: role || 'GUARD',
        team_member_id,
        created_by: req.user.id
      });

      await logActivity({
        type: 'USER_CREATED',
        ref_id: newUser.id,
        actor: req.user.name,
        note: `New user created: ${username} (${role || 'GUARD'})`,
        severity: 'INFO'
      });

      // Return user without password_hash
      const { password_hash, password_reset_token, ...userSafe } = newUser;

      return res.status(201).json({
        success: true,
        data: userSafe,
        message: `User ${username} created successfully`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[UserController] createUser error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create user',
        message: error.message
      });
    }
  }

  /**
   * GET /api/users
   * List all users (ADMIN or SUPER_ADMIN only)
   * Query params: role, account_status, limit, offset
   */
  static async listUsers(req, res) {
    try {
      const {
        role,
        account_status,
        limit = 50,
        offset = 0
      } = req.query;

      // Use raw User methods instead of findAll to avoid caching issues
      let users;
      if (role || account_status) {
        // If filters provided, use findAll
        const filters = {
          role: role || undefined,
          account_status: account_status || undefined,
          limit: Math.min(parseInt(limit) || 50, 500),
          offset: parseInt(offset) || 0
        };
        users = await User.findAll(filters);
      } else {
        // If no filters, get all users directly
        users = await User.findAll({
          limit: Math.min(parseInt(limit) || 50, 500),
          offset: parseInt(offset) || 0
        });
      }

      const total = await User.getCount();

      return res.json({
        success: true,
        data: {
          users,
          total,
          filters: {
            role: role || null,
            account_status: account_status || null
          },
          pagination: {
            limit: Math.min(parseInt(limit) || 50, 500),
            offset: parseInt(offset) || 0
          }
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[UserController] listUsers error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to list users',
        message: error.message
      });
    }
  }

  /**
   * GET /api/users/:id
   * Get user details (ADMIN or SUPER_ADMIN only)
   */
  static async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Return user without password_hash
      const { password_hash, password_reset_token, ...userSafe } = user;

      return res.json({
        success: true,
        data: userSafe,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[UserController] getUserById error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/users/:id
   * Update user info (ADMIN or SUPER_ADMIN only)
   * Body: { email?, name?, role?, team_member_id? }
   */
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { email, name, role, team_member_id } = req.body;

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Validate role if provided
      if (role) {
        const validRoles = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'GUARD', 'VIEWER'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            success: false,
            error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
          });
        }
      }

      // Check if new email already exists (if email is being changed)
      if (email && email !== user.email) {
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
          return res.status(409).json({
            success: false,
            error: 'Email already in use by another user'
          });
        }
      }

      // Update user
      await User.update(id, {
        email: email || user.email,
        name: name || user.name,
        role: role || user.role,
        team_member_id
      });

      const updatedUser = await User.findById(id);

      await logActivity({
        type: 'USER_UPDATED',
        ref_id: id,
        actor: req.user.name,
        note: `User updated: ${user.username}`,
        severity: 'INFO'
      });

      // Return user without password_hash
      const { password_hash, password_reset_token, ...userSafe } = updatedUser;

      return res.json({
        success: true,
        data: userSafe,
        message: 'User updated successfully',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[UserController] updateUser error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update user',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/users/:id
   * Delete user (SUPER_ADMIN only - soft delete)
   */
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent deleting self
      if (id === req.user.id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete your own user account'
        });
      }

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Soft delete - set to INACTIVE
      await User.delete(id);

      await logActivity({
        type: 'USER_DELETED',
        ref_id: id,
        actor: req.user.name,
        note: `User deleted (deactivated): ${user.username}`,
        severity: 'WARNING'
      });

      return res.json({
        success: true,
        message: `User ${user.username} deleted successfully`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[UserController] deleteUser error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user',
        message: error.message
      });
    }
  }

  /**
   * PATCH /api/users/:id/role
   * Change user role (SUPER_ADMIN only)
   * Body: { role }
   */
  static async changeUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          error: 'role is required'
        });
      }

      // Validate role
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'GUARD', 'VIEWER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Cannot change own role
      if (id === req.user.id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot change your own role'
        });
      }

      // Update role
      await User.update(id, { role });

      const updatedUser = await User.findById(id);

      await logActivity({
        type: 'USER_ROLE_CHANGED',
        ref_id: id,
        actor: req.user.name,
        note: `User role changed from ${user.role} to ${role}: ${user.username}`,
        severity: 'WARNING'
      });

      // Return user without password_hash
      const { password_hash, password_reset_token, ...userSafe } = updatedUser;

      return res.json({
        success: true,
        data: userSafe,
        message: `User role changed to ${role}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[UserController] changeUserRole error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to change user role',
        message: error.message
      });
    }
  }

  /**
   * POST /api/users/:id/unlock
   * Unlock locked user account (ADMIN or SUPER_ADMIN)
   */
  static async unlockUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.account_status !== 'LOCKED') {
        return res.status(400).json({
          success: false,
          error: 'User account is not locked',
          current_status: user.account_status
        });
      }

      // Unlock account
      await User.unlockAccount(id);

      await logActivity({
        type: 'USER_UNLOCKED',
        ref_id: id,
        actor: req.user.name,
        note: `Locked account unlocked: ${user.username}`,
        severity: 'WARNING'
      });

      const updatedUser = await User.findById(id);

      // Return user without password_hash
      const { password_hash, password_reset_token, ...userSafe } = updatedUser;

      return res.json({
        success: true,
        data: userSafe,
        message: 'User account unlocked successfully',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[UserController] unlockUser error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to unlock user',
        message: error.message
      });
    }
  }
}

module.exports = UserController;
