/**
 * Models Index
 * Exports all models for the application and initializes associations
 */

// Import all models
const Alert = require('./Alert');
const AlertRecipient = require('./AlertRecipient');
const BasemapConfig = require('./BasemapConfig');
const Camera = require('./Camera');
const CameraHealthLog = require('./CameraHealthLog');
const FeatureFlag = require('./FeatureFlag');
const Geofence = require('./Geofence');
const GeofenceBreach = require('./GeofenceBreach');
const Incident = require('./Incident');
const MapPin = require('./MapPin');
const Perumahan = require('./Perumahan');
const QRCode = require('./QRCode');
const SecurityActivity = require('./SecurityActivity');
const TeamLocationHistory = require('./TeamLocationHistory');
const TeamMember = require('./TeamMember');
const CrossingEvent = require('./CrossingEvent');
const PersonVisit = require('./PersonVisit');
const VisitorRegistration = require('./VisitorRegistration');

// Create models object (only Sequelize models for associations)
const sequelizeModels = {
  Alert,
  AlertRecipient,
  BasemapConfig,
  Camera,
  CameraHealthLog,
  CrossingEvent,
  PersonVisit,
  FeatureFlag,
  Geofence,
  GeofenceBreach,
  Incident,
  MapPin,
  Perumahan,
  QRCode,
  SecurityActivity, // Now uses Sequelize
  TeamLocationHistory,
  VisitorRegistration
  // Note: SecurityActivity and TeamMember use raw MySQL, excluded from associations
};

// Initialize associations (only for Sequelize models)
Object.keys(sequelizeModels).forEach(modelName => {
  if (sequelizeModels[modelName].associate) {
    sequelizeModels[modelName].associate(sequelizeModels);
  }
});

// Export all models (including raw MySQL models)
const models = {
  ...sequelizeModels,
  SecurityActivity,
  TeamMember
};

// Export all models
module.exports = models;