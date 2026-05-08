'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create qr_codes table first (referenced by visitor_registrations)
    await queryInterface.createTable('qr_codes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      entry_point: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      qr_data: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true
      },
      location_lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false
      },
      location_lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false
      },
      geofence_radius: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      max_daily_registrations: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      operating_hours: {
        type: Sequelize.JSON,
        allowNull: true
      },
      security_level: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'restricted'),
        allowNull: false,
        defaultValue: 'medium'
      },
      requires_approval: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      auto_approve_roles: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: '[]'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: '{}'
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      usage_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_by: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      updated_by: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create visitor_registrations table
    await queryInterface.createTable('visitor_registrations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      photo_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      purpose: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'Visit'
      },
      entry_point: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      location_lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      },
      location_lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      },
      qr_code_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'qr_codes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'expired'),
        allowNull: false,
        defaultValue: 'pending'
      },
      approved_by: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejected_by: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      rejected_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      checked_in_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      checked_out_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: '{}'
      },
      created_by: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      updated_by: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for qr_codes table
    await queryInterface.addIndex('qr_codes', ['qr_data'], {
      unique: true,
      name: 'qr_codes_qr_data_unique'
    });
    await queryInterface.addIndex('qr_codes', ['entry_point']);
    await queryInterface.addIndex('qr_codes', ['is_active']);
    await queryInterface.addIndex('qr_codes', ['security_level']);
    await queryInterface.addIndex('qr_codes', ['created_at']);
    await queryInterface.addIndex('qr_codes', ['last_used_at']);

    // Add indexes for visitor_registrations table
    await queryInterface.addIndex('visitor_registrations', ['status']);
    await queryInterface.addIndex('visitor_registrations', ['entry_point']);
    await queryInterface.addIndex('visitor_registrations', ['qr_code_id']);
    await queryInterface.addIndex('visitor_registrations', ['created_at']);
    await queryInterface.addIndex('visitor_registrations', ['status', 'created_at']);
    await queryInterface.addIndex('visitor_registrations', ['phone']);
    await queryInterface.addIndex('visitor_registrations', ['expires_at']);

    // Insert sample QR codes for testing
    await queryInterface.bulkInsert('qr_codes', [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        entry_point: 'Main Gate',
        qr_data: 'main-gate-' + Date.now() + '-sample1',
        location_lat: -6.2088,
        location_lng: 106.8456,
        geofence_radius: 50,
        is_active: true,
        description: 'Main entrance gate for visitors',
        security_level: 'medium',
        requires_approval: true,
        metadata: JSON.stringify({ zone: 'entrance', building: 'main' }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        entry_point: 'Security Office',
        qr_data: 'security-office-' + Date.now() + '-sample2',
        location_lat: -6.2090,
        location_lng: 106.8458,
        geofence_radius: 30,
        is_active: true,
        description: 'Security office entrance',
        security_level: 'high',
        requires_approval: true,
        metadata: JSON.stringify({ zone: 'security', building: 'admin' }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        entry_point: 'Parking Area',
        qr_data: 'parking-area-' + Date.now() + '-sample3',
        location_lat: -6.2085,
        location_lng: 106.8460,
        geofence_radius: 100,
        is_active: true,
        description: 'Visitor parking area',
        security_level: 'low',
        requires_approval: false,
        auto_approve_roles: JSON.stringify(['visitor', 'guest']),
        metadata: JSON.stringify({ zone: 'parking', capacity: 50 }),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order (due to foreign key constraints)
    await queryInterface.dropTable('visitor_registrations');
    await queryInterface.dropTable('qr_codes');
  }
};