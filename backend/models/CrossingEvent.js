const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CrossingEvent = sequelize.define('CrossingEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  cameraId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'camera_id'
  },
  direction: {
    type: DataTypes.ENUM('in', 'out'),
    allowNull: false
  },
  crossedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'crossed_at'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'crossing_events',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['camera_id'] },
    { fields: ['direction'] },
    { fields: ['crossed_at'] },
    { fields: ['camera_id', 'crossed_at'] },
    { fields: ['camera_id', 'direction', 'crossed_at'] }
  ]
});

module.exports = CrossingEvent;
