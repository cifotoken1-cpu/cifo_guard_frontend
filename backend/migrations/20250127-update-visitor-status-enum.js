'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update the status ENUM to include 'checked_in' and 'checked_out'
    await queryInterface.sequelize.query(
      "ALTER TABLE visitor_registrations MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'expired', 'checked_in', 'checked_out') NOT NULL DEFAULT 'pending'"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to original ENUM values
    // First, update any 'checked_in' or 'checked_out' records to 'approved'
    await queryInterface.sequelize.query(
      "UPDATE visitor_registrations SET status = 'approved' WHERE status IN ('checked_in', 'checked_out')"
    );
    
    // Then modify the ENUM back to original values
    await queryInterface.sequelize.query(
      "ALTER TABLE visitor_registrations MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending'"
    );
  }
};