/**
 * User Model
 * Handles user account management, authentication, and password operations
 * Uses raw mysql2 connection (not Sequelize) to match existing patterns
 */

const mysql = require('mysql2/promise');
const bcryptjs = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

class User {
  /**
   * Get database connection
   * @returns {Promise<Connection>} MySQL connection
   */
  static async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cifo_security',
      charset: 'utf8mb4'
    });
  }

  /**
   * Hash a plaintext password using bcryptjs
   * @param {string} plaintext - Plaintext password
   * @returns {string} Hashed password
   */
  static hashPassword(plaintext) {
    const salt = bcryptjs.genSaltSync(10);
    return bcryptjs.hashSync(plaintext, salt);
  }

  /**
   * Compare plaintext password with hash
   * @param {string} plaintext - Plaintext password
   * @param {string} hash - Hashed password from DB
   * @returns {boolean} Match result
   */
  static comparePassword(plaintext, hash) {
    return bcryptjs.compareSync(plaintext, hash);
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByUsername(username) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  static async findById(id) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Find user by email
   * @param {string} email - Email address
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByEmail(email) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Find all users with optional filters
   * @param {Object} filters - Query filters (role, account_status, limit, offset)
   * @returns {Promise<Array>} Array of user objects
   */
  static async findAll(filters = {}) {
    const connection = await this.getConnection();
    try {
      const { role, account_status, limit = 50, offset = 0 } = filters;
      let query = 'SELECT id, username, email, name, role, account_status, last_login_at, created_at FROM users';
      const params = [];
      const conditions = [];

      if (role) {
        conditions.push('role = ?');
        params.push(role);
      }

      if (account_status) {
        conditions.push('account_status = ?');
        params.push(account_status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const [rows] = await connection.execute(query, params);
      return rows;
    } finally {
      await connection.end();
    }
  }

  /**
   * Authenticate user with username and password
   * Records failed attempts, returns user and JWT token on success
   * @param {string} username - Username
   * @param {string} password - Plaintext password
   * @returns {Promise<Object|null>} { user, token } or null if auth fails
   */
  static async authenticate(username, password) {
    const user = await this.findByUsername(username);

    // User not found
    if (!user) {
      return null;
    }

    // User account locked or inactive
    if (user.account_status === 'LOCKED' || user.account_status === 'INACTIVE') {
      return null;
    }

    // Verify password
    const isValid = this.comparePassword(password, user.password_hash);

    if (!isValid) {
      // Record failed login attempt
      await this.recordLoginAttempt(user.id, false);
      return null;
    }

    // Password valid - record success and generate token
    await this.recordLoginAttempt(user.id, true);

    // Generate JWT token using middleware function
    const { generateToken } = require('../middleware/auth');
    const token = generateToken({ id: user.id, userId: user.id, role: user.role }, '24h');

    // Return user without password_hash
    const { password_hash, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  }

  /**
   * Create new user
   * @param {Object} userData - User data { username, email, name, password, role, team_member_id?, created_by? }
   * @returns {Promise<Object>} Created user object
   */
  static async create(userData) {
    const connection = await this.getConnection();
    try {
      const {
        id = `user_${Date.now()}`,
        username,
        email,
        name,
        password,
        role = 'GUARD',
        team_member_id = null,
        created_by = null
      } = userData;

      // Validate required fields
      if (!username || !email || !name || !password) {
        throw new Error('Missing required fields: username, email, name, password');
      }

      // Hash password
      const password_hash = this.hashPassword(password);

      const [result] = await connection.execute(
        `INSERT INTO users
         (id, username, email, name, password_hash, role, account_status, team_member_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, CURRENT_TIMESTAMP)`,
        [id, username, email, name, password_hash, role, team_member_id, created_by]
      );

      return await this.findById(id);
    } finally {
      await connection.end();
    }
  }

  /**
   * Update user info
   * @param {string} id - User ID
   * @param {Object} userData - Data to update { email?, name?, role?, team_member_id? }
   * @returns {Promise<boolean>} Success status
   */
  static async update(id, userData) {
    const connection = await this.getConnection();
    try {
      const { email, name, role, team_member_id } = userData;
      const updates = [];
      const params = [];

      if (email) {
        updates.push('email = ?');
        params.push(email);
      }

      if (name) {
        updates.push('name = ?');
        params.push(name);
      }

      if (role) {
        updates.push('role = ?');
        params.push(role);
      }

      if (team_member_id !== undefined) {
        updates.push('team_member_id = ?');
        params.push(team_member_id);
      }

      if (updates.length === 0) {
        return true; // No updates
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      const [result] = await connection.execute(query, params);

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  /**
   * Update user password (requires hashing)
   * @param {string} id - User ID
   * @param {string} newPassword - New plaintext password
   * @returns {Promise<boolean>} Success status
   */
  static async updatePassword(id, newPassword) {
    const connection = await this.getConnection();
    try {
      const password_hash = this.hashPassword(newPassword);

      const [result] = await connection.execute(
        `UPDATE users
         SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [password_hash, id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  /**
   * Delete user (soft delete - set to INACTIVE)
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE users SET account_status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  /**
   * Hard delete user from database
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async hardDelete(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM users WHERE id = ?',
        [id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  /**
   * Record login attempt (success or failure)
   * @param {string} id - User ID
   * @param {boolean} success - Whether login was successful
   * @returns {Promise<void>}
   */
  static async recordLoginAttempt(id, success) {
    const connection = await this.getConnection();
    try {
      if (success) {
        // Reset failed attempts on success
        await connection.execute(
          `UPDATE users
           SET failed_login_attempts = 0, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [id]
        );
      } else {
        // Increment failed attempts, lock account if >= 5
        const [userRows] = await connection.execute(
          'SELECT failed_login_attempts, account_status FROM users WHERE id = ?',
          [id]
        );

        if (userRows[0]) {
          const newAttempts = userRows[0].failed_login_attempts + 1;
          const shouldLock = newAttempts >= 5;

          await connection.execute(
            `UPDATE users
             SET failed_login_attempts = ?, account_status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newAttempts, shouldLock ? 'LOCKED' : userRows[0].account_status, id]
          );
        }
      }
    } finally {
      await connection.end();
    }
  }

  /**
   * Lock user account
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async lockAccount(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE users SET account_status = 'LOCKED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  /**
   * Unlock user account and reset failed attempts
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async unlockAccount(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE users
         SET account_status = 'ACTIVE', failed_login_attempts = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  /**
   * Generate password reset token
   * @param {string} id - User ID
   * @returns {Promise<string|null>} Reset token or null if user not found
   */
  static async setResetToken(id) {
    const connection = await this.getConnection();
    try {
      // Generate random token
      const token = crypto.randomBytes(32).toString('hex');

      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      const [result] = await connection.execute(
        `UPDATE users
         SET password_reset_token = ?, password_reset_expires = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [token, expiresAt, id]
      );

      if (result.affectedRows > 0) {
        return token;
      }
      return null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Find user by reset token
   * @param {string} token - Password reset token
   * @returns {Promise<Object|null>} User object if token is valid and not expired, null otherwise
   */
  static async findByResetToken(token) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM users
         WHERE password_reset_token = ? AND password_reset_expires > NOW()`,
        [token]
      );

      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Clear password reset token
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async clearResetToken(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE users
         SET password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  /**
   * Get total user count
   * @returns {Promise<number>} Total user count
   */
  static async getCount() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT COUNT(*) as total FROM users'
      );

      return rows[0].total;
    } finally {
      await connection.end();
    }
  }
}

module.exports = User;
