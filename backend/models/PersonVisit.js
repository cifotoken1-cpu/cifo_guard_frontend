const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PersonVisit = sequelize.define('PersonVisit', {
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
  personUid: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'person_uid'
  },
  entryTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'entry_time'
  },
  exitTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'exit_time'
  },
  durationSeconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'duration_seconds'
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  matchMethod: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'match_method'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'person_visits',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['camera_id'] },
    { fields: ['person_uid'] },
    { fields: ['entry_time'] },
    { fields: ['exit_time'] },
    { fields: ['camera_id', 'entry_time'] },
    { fields: ['camera_id', 'exit_time'], where: { exit_time: { [require('sequelize').Op.ne]: null } } }
  ]
});

module.exports = PersonVisit;
