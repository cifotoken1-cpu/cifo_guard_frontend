'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('person_visits', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      camera_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        references: {
          model: 'cameras',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      person_uid: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      entry_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      exit_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      duration_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      match_method: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('person_visits', ['camera_id']);
    await queryInterface.addIndex('person_visits', ['person_uid']);
    await queryInterface.addIndex('person_visits', ['entry_time']);
    await queryInterface.addIndex('person_visits', ['exit_time']);
    await queryInterface.addIndex('person_visits', ['camera_id', 'entry_time']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('person_visits');
  }
};
