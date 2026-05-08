const { Server } = require('socket.io');
const SecurityActivity = require('../models/SecurityActivity');
const Camera = require('../models/Camera');
const TeamMember = require('../models/TeamMember');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.rooms = {
      ADMIN: 'admin_room',
      SECURITY: 'security_room',
      MONITORING: 'monitoring_room',
      ALERTS: 'alerts_room'
    };
  }

  // Initialize WebSocket server
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.startPeriodicUpdates();
    
    console.log('WebSocket service initialized');
    return this.io;
  }

  // Setup event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Store client info
      this.connectedClients.set(socket.id, {
        socket,
        connectedAt: new Date(),
        user: null,
        rooms: []
      });

      // Handle authentication
      socket.on('authenticate', (data) => {
        this.handleAuthentication(socket, data);
      });

      // Handle room joining
      socket.on('join_room', (roomName) => {
        this.handleJoinRoom(socket, roomName);
      });

      // Handle room leaving
      socket.on('leave_room', (roomName) => {
        this.handleLeaveRoom(socket, roomName);
      });

      // Handle camera status updates
      socket.on('camera_status_update', (data) => {
        this.handleCameraStatusUpdate(socket, data);
      });

      // Handle team location updates
      socket.on('team_location_update', (data) => {
        this.handleTeamLocationUpdate(socket, data);
      });

      // Handle security alerts
      socket.on('security_alert', (data) => {
        this.handleSecurityAlert(socket, data);
      });

      // Handle activity logging
      socket.on('log_activity', (data) => {
        this.handleActivityLogging(socket, data);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

      // Send initial connection success
      socket.emit('connected', {
        message: 'Connected to CIFO Security WebSocket',
        timestamp: new Date(),
        socketId: socket.id
      });
    });
  }

  // Handle client authentication
  handleAuthentication(socket, data) {
    try {
      const { user, token, role } = data;
      
      // In a real implementation, you would validate the token here
      // For now, we'll accept the provided user data
      
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo) {
        clientInfo.user = { ...user, role };
        
        // Auto-join appropriate rooms based on role
        if (role === 'admin') {
          this.handleJoinRoom(socket, this.rooms.ADMIN);
          this.handleJoinRoom(socket, this.rooms.MONITORING);
          this.handleJoinRoom(socket, this.rooms.ALERTS);
        } else if (role === 'security') {
          this.handleJoinRoom(socket, this.rooms.SECURITY);
          this.handleJoinRoom(socket, this.rooms.ALERTS);
        } else {
          this.handleJoinRoom(socket, this.rooms.MONITORING);
        }
      }

      socket.emit('authenticated', {
        success: true,
        user: clientInfo.user,
        rooms: clientInfo.rooms
      });

      // Log authentication
      this.logActivity({
        type: 'USER_CONNECTED',
        actor: user?.name || 'Unknown User',
        note: `User connected via WebSocket (Role: ${role})`,
        severity: 'INFO',
        source: 'websocket'
      });

    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('authentication_error', {
        success: false,
        message: 'Authentication failed',
        error: error.message
      });
    }
  }

  // Handle joining rooms
  handleJoinRoom(socket, roomName) {
    try {
      socket.join(roomName);
      
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo && !clientInfo.rooms.includes(roomName)) {
        clientInfo.rooms.push(roomName);
      }

      socket.emit('room_joined', {
        room: roomName,
        timestamp: new Date()
      });

      console.log(`Client ${socket.id} joined room: ${roomName}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('room_error', {
        message: 'Failed to join room',
        room: roomName,
        error: error.message
      });
    }
  }

  // Handle leaving rooms
  handleLeaveRoom(socket, roomName) {
    try {
      socket.leave(roomName);
      
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo) {
        clientInfo.rooms = clientInfo.rooms.filter(room => room !== roomName);
      }

      socket.emit('room_left', {
        room: roomName,
        timestamp: new Date()
      });

      console.log(`Client ${socket.id} left room: ${roomName}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }

  // Handle camera status updates
  async handleCameraStatusUpdate(socket, data) {
    try {
      const { camera_id, status, metadata } = data;
      
      // Update camera status in database
      await Camera.updateStatus(camera_id, status);
      
      // Broadcast to monitoring room
      this.io.to(this.rooms.MONITORING).emit('camera_status_changed', {
        camera_id,
        status,
        metadata,
        timestamp: new Date(),
        updated_by: this.getClientUser(socket.id)?.name || 'System'
      });

      // Log activity
      await this.logActivity({
        type: 'CAMERA_STATUS_CHANGED',
        ref_id: camera_id,
        actor: this.getClientUser(socket.id)?.name || 'System',
        note: `Camera status changed to ${status}`,
        severity: status === 'OFFLINE' ? 'ERROR' : 'INFO',
        source: 'websocket'
      });

    } catch (error) {
      console.error('Error handling camera status update:', error);
      socket.emit('error', {
        message: 'Failed to update camera status',
        error: error.message
      });
    }
  }

  // Handle team location updates
  async handleTeamLocationUpdate(socket, data) {
    try {
      const { member_id, latitude, longitude, area } = data;
      
      // Update team member location
      await TeamMember.updateLocation(member_id, {
        current_latitude: latitude,
        current_longitude: longitude,
        current_area: area
      });
      
      // Broadcast to security and admin rooms
      const locationUpdate = {
        member_id,
        latitude,
        longitude,
        area,
        timestamp: new Date(),
        updated_by: this.getClientUser(socket.id)?.name || 'System'
      };

      this.io.to(this.rooms.SECURITY).emit('team_location_updated', locationUpdate);
      this.io.to(this.rooms.ADMIN).emit('team_location_updated', locationUpdate);

    } catch (error) {
      console.error('Error handling team location update:', error);
      socket.emit('error', {
        message: 'Failed to update team location',
        error: error.message
      });
    }
  }

  // Handle security alerts
  async handleSecurityAlert(socket, data) {
    try {
      const {
        type,
        severity = 'WARNING',
        message,
        location,
        metadata
      } = data;

      const alert = {
        type,
        severity,
        message,
        location,
        metadata,
        timestamp: new Date(),
        reported_by: this.getClientUser(socket.id)?.name || 'System'
      };

      // Broadcast alert to all relevant rooms
      this.io.to(this.rooms.ALERTS).emit('security_alert', alert);
      this.io.to(this.rooms.ADMIN).emit('security_alert', alert);
      this.io.to(this.rooms.SECURITY).emit('security_alert', alert);

      // Log the alert as an activity
      await this.logActivity({
        type: 'SECURITY_ALERT',
        actor: alert.reported_by,
        note: `Security Alert: ${message}`,
        severity,
        metadata: JSON.stringify({ location, ...metadata }),
        source: 'websocket'
      });

    } catch (error) {
      console.error('Error handling security alert:', error);
      socket.emit('error', {
        message: 'Failed to process security alert',
        error: error.message
      });
    }
  }

  // Handle activity logging
  async handleActivityLogging(socket, data) {
    try {
      const activityData = {
        ...data,
        actor: data.actor || this.getClientUser(socket.id)?.name || 'System',
        source: 'websocket'
      };

      await this.logActivity(activityData);
      
      socket.emit('activity_logged', {
        success: true,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error logging activity:', error);
      socket.emit('error', {
        message: 'Failed to log activity',
        error: error.message
      });
    }
  }

  // Handle client disconnection
  handleDisconnection(socket, reason) {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    
    const clientInfo = this.connectedClients.get(socket.id);
    if (clientInfo && clientInfo.user) {
      // Log disconnection
      this.logActivity({
        type: 'USER_DISCONNECTED',
        actor: clientInfo.user.name || 'Unknown User',
        note: `User disconnected from WebSocket (Reason: ${reason})`,
        severity: 'INFO',
        source: 'websocket'
      });
    }
    
    this.connectedClients.delete(socket.id);
  }

  // Start periodic updates
  startPeriodicUpdates() {
    // Send system stats every 30 seconds
    setInterval(async () => {
      try {
        const stats = await this.getSystemStats();
        this.io.to(this.rooms.MONITORING).emit('system_stats', stats);
      } catch (error) {
        console.error('Error sending system stats:', error);
      }
    }, 30000);

    // Send heartbeat every 60 seconds
    setInterval(() => {
      this.io.emit('heartbeat', {
        timestamp: new Date(),
        connected_clients: this.connectedClients.size
      });
    }, 60000);
  }

  // Get system statistics
  async getSystemStats() {
    try {
      // Use Promise.allSettled to handle individual failures gracefully
      const [cameraResult, teamResult, activityResult] = await Promise.allSettled([
        Camera.getStats().catch(err => ({ error: 'Camera stats unavailable', details: err.message })),
        TeamMember.getStats().catch(err => ({ error: 'Team stats unavailable', details: err.message })),
        SecurityActivity.getStats('1h').catch(err => ({ error: 'Activity stats unavailable', details: err.message }))
      ]);

      const cameraStats = cameraResult.status === 'fulfilled' ? cameraResult.value : { error: 'Camera stats failed' };
      const teamStats = teamResult.status === 'fulfilled' ? teamResult.value : { error: 'Team stats failed' };
      const activityStats = activityResult.status === 'fulfilled' ? activityResult.value : { error: 'Activity stats failed' };

      return {
        cameras: cameraStats,
        team: teamStats,
        activities: activityStats,
        websocket: {
          connected_clients: this.connectedClients.size,
          rooms: Object.keys(this.rooms)
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return {
        error: 'Failed to retrieve system stats',
        timestamp: new Date()
      };
    }
  }

  // Utility methods
  getClientUser(socketId) {
    const clientInfo = this.connectedClients.get(socketId);
    return clientInfo ? clientInfo.user : null;
  }

  async logActivity(activityData) {
    try {
      await SecurityActivity.create(activityData);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // Public methods for external use
  broadcastToRoom(roomName, event, data) {
    if (this.io) {
      this.io.to(roomName).emit(event, data);
    }
  }

  broadcastToAll(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // Alias for broadcastToAll for backward compatibility
  broadcast(event, data) {
    this.broadcastToAll(event, data);
  }

  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  getConnectedClients() {
    const clients = [];
    this.connectedClients.forEach((clientInfo, socketId) => {
      clients.push({
        socketId,
        user: clientInfo.user,
        connectedAt: clientInfo.connectedAt,
        rooms: clientInfo.rooms
      });
    });
    return clients;
  }

  // Send notification to specific user role
  sendNotificationToRole(role, event, data) {
    this.connectedClients.forEach((clientInfo, socketId) => {
      if (clientInfo.user && clientInfo.user.role === role) {
        clientInfo.socket.emit(event, data);
      }
    });
  }

  // Send emergency alert
  sendEmergencyAlert(alertData) {
    const emergencyAlert = {
      ...alertData,
      type: 'EMERGENCY',
      severity: 'CRITICAL',
      timestamp: new Date()
    };

    this.broadcastToAll('emergency_alert', emergencyAlert);
    
    // Also log as activity
    this.logActivity({
      type: 'EMERGENCY_ALERT',
      actor: 'System',
      note: `Emergency Alert: ${alertData.message}`,
      severity: 'CRITICAL',
      source: 'websocket'
    });
  }
}

// Export singleton instance
module.exports = new WebSocketService();