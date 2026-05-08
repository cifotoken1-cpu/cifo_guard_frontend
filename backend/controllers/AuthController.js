/**
 * Auth Controller
 * Handles login, logout, current user, password change, and password reset
 */

const User = require('../models/User');

// Try to import SecurityActivity for audit logging
let SecurityActivity;
try {
  SecurityActivity = require('../models/SecurityActivity');
} catch (e) {
  console.warn('[AuthController] SecurityActivity model not available, audit logging disabled');
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
      console.error('[AuthController] Failed to log activity:', err.message);
    }
  }
}

class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate user and return JWT token
   */
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password required'
        });
      }

      // Check user exists first (for specific error messages)
      const userCheck = await User.findByUsername(username);

      if (!userCheck) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // Check account status before authenticating
      if (userCheck.account_status === 'LOCKED') {
        await logActivity({
          type: 'LOGIN_FAILED_LOCKED',
          ref_id: userCheck.id,
          actor: username,
          note: `Login blocked - account is locked`,
          severity: 'WARNING'
        });

        return res.status(403).json({
          success: false,
          error: 'Account is locked. Contact administrator.',
          code: 'ACCOUNT_LOCKED'
        });
      }

      if (userCheck.account_status === 'INACTIVE') {
        return res.status(403).json({
          success: false,
          error: 'Account is inactive. Contact administrator.',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Authenticate (verify password)
      const result = await User.authenticate(username, password);

      if (!result) {
        // Login failed - user exists but wrong password
        const updatedUser = await User.findById(userCheck.id);

        await logActivity({
          type: 'LOGIN_FAILED',
          ref_id: userCheck.id,
          actor: username,
          note: `Failed login attempt. Failed attempts: ${updatedUser ? updatedUser.failed_login_attempts : '?'}`,
          severity: 'WARNING'
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // Login successful
      await logActivity({
        type: 'LOGIN_SUCCESS',
        ref_id: result.user.id,
        actor: result.user.name,
        note: `User logged in successfully`,
        severity: 'INFO'
      });

      return res.json({
        success: true,
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            account_status: result.user.account_status,
            last_login_at: result.user.last_login_at
          }
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[AuthController] Login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Login failed. Please try again.'
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Logout current user (requires valid token)
   * Token invalidation is client-side (stateless JWT)
   */
  static async logout(req, res) {
    try {
      await logActivity({
        type: 'LOGOUT',
        ref_id: req.user.id,
        actor: req.user.name,
        note: 'User logged out',
        severity: 'INFO'
      });

      return res.json({
        success: true,
        message: 'Logged out successfully',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[AuthController] Logout error:', error);
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  /**
   * GET /api/auth/me
   * Get current authenticated user info
   */
  static async getCurrentUser(req, res) {
    try {
      // req.user is set by verifyToken middleware
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Return user without password_hash
      const { password_hash, password_reset_token, password_reset_expires, ...userSafe } = user;

      return res.json({
        success: true,
        data: userSafe,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[AuthController] getCurrentUser error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user info'
      });
    }
  }

  /**
   * PUT /api/auth/change-password
   * Change password for current authenticated user
   * Body: { current_password, new_password }
   */
  static async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json({
          success: false,
          error: 'current_password and new_password are required'
        });
      }

      if (new_password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 8 characters'
        });
      }

      // Get current user with password hash
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Verify current password
      const isCurrentValid = User.comparePassword(current_password, user.password_hash);

      if (!isCurrentValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Update password
      await User.updatePassword(req.user.id, new_password);

      await logActivity({
        type: 'PASSWORD_CHANGED',
        ref_id: req.user.id,
        actor: req.user.name,
        note: 'User changed their password',
        severity: 'INFO'
      });

      return res.json({
        success: true,
        message: 'Password changed successfully',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[AuthController] changePassword error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Request password reset (returns token for admin-driven flow)
   * Body: { email }
   */
  static async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      const user = await User.findByEmail(email);

      // Always return success to prevent email enumeration attacks
      if (!user) {
        return res.json({
          success: true,
          message: 'If that email exists, a reset token has been generated.',
          timestamp: Date.now()
        });
      }

      // Generate reset token
      const resetToken = await User.setResetToken(user.id);

      await logActivity({
        type: 'PASSWORD_RESET_REQUESTED',
        ref_id: user.id,
        actor: user.name,
        note: 'Password reset requested',
        severity: 'WARNING'
      });

      return res.json({
        success: true,
        message: 'Password reset token generated',
        data: {
          reset_token: resetToken,
          expires_in: '1 hour',
          user_id: user.id,
          username: user.username
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[AuthController] requestPasswordReset error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate reset token'
      });
    }
  }

  /**
   * POST /api/auth/reset-password/confirm
   * Confirm password reset with token
   * Body: { token, new_password }
   */
  static async confirmPasswordReset(req, res) {
    try {
      const { token, new_password } = req.body;

      if (!token || !new_password) {
        return res.status(400).json({
          success: false,
          error: 'token and new_password are required'
        });
      }

      if (new_password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      // Validate reset token
      const user = await User.findByResetToken(token);

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN'
        });
      }

      // Update password and clear token
      await User.updatePassword(user.id, new_password);

      // Unlock account if it was locked
      if (user.account_status === 'LOCKED') {
        await User.unlockAccount(user.id);
      }

      await logActivity({
        type: 'PASSWORD_RESET_SUCCESS',
        ref_id: user.id,
        actor: user.name,
        note: 'Password reset completed successfully',
        severity: 'INFO'
      });

      return res.json({
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[AuthController] confirmPasswordReset error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }
}

module.exports = AuthController;
