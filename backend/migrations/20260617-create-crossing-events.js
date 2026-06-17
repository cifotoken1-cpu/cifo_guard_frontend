'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('crossing_events', {
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
      direction: {
        type: Sequelize.ENUM('in', 'out'),
        allowNull: false
      },
      crossed_at: {
        type: Sequelize.DATE,
        allowNull: false
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

    await queryInterface.addIndex('crossing_events', ['camera_id']);
    await queryInterface.addIndex('crossing_events', ['direction']);
    await queryInterface.addIndex('crossing_events', ['crossed_at']);
    await queryInterface.addIndex('crossing_events', ['camera_id', 'crossed_at']);
    await queryInterface.addIndex('crossing_events', ['camera_id', 'direction', 'crossed_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('crossing_events');
  }
};
