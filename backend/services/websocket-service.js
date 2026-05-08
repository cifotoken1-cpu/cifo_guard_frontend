const WebSocket = require('ws');
const { logActivity } = require('./activity-service');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws, req) => {
      console.log('[WebSocket] New client connected');
      this.clients.add(ws);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        timestamp: new Date().toISOString(),
        message: 'WebSocket connection established'
      }));
      
      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.clients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error);
        this.clients.delete(ws);
      });
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('[WebSocket] Received message:', data);
          
          // Handle ping/pong for keepalive
          if (data.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch (error) {
          console.error('[WebSocket] Invalid message format:', error);
        }
      });
    });
    
    console.log('[WebSocket] Server initialized');
  }

  /**
   * Broadcast alert to all connected clients
   */
  broadcastAlert(alert) {
    if (!this.wss) {
      console.warn('[WebSocket] Server not initialized');
      return;
    }
    
    const message = {
      type: 'ALERT_CREATED',
      data: alert,
      timestamp: new Date().toISOString()
    };
    
    this.broadcast(message);
    console.log(`[WebSocket] Broadcasted new alert: ${alert.id}`);
  }

  /**
   * Broadcast alert update to all connected clients
   */
  broadcastAlertUpdate(alert) {
    if (!this.wss) {
      console.warn('[WebSocket] Server not initialized');
      return;
    }
    
    const message = {
      type: 'ALERT_UPDATED',
      data: alert,
      timestamp: new Date().toISOString()
    };
    
    this.broadcast(message);
    console.log(`[WebSocket] Broadcasted alert update: ${alert.id}`);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    let errorCount = 0;
    
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error('[WebSocket] Error sending message to client:', error);
          errorCount++;
          this.clients.delete(ws);
        }
      } else {
        // Remove closed connections
        this.clients.delete(ws);
      }
    });
    
    console.log(`[WebSocket] Message sent to ${sentCount} clients, ${errorCount} errors`);
  }

  /**
   * Get connected clients count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Close all connections and shutdown server
   */
  shutdown() {
    if (this.wss) {
      this.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      this.clients.clear();
      this.wss.close();
      console.log('[WebSocket] Server shutdown');
    }
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

// Export functions for backward compatibility
module.exports = {
  webSocketService,
  initialize: (server) => webSocketService.initialize(server),
  broadcastAlert: (alert) => webSocketService.broadcastAlert(alert),
  broadcastAlertUpdate: (alert) => webSocketService.broadcastAlertUpdate(alert),
  broadcast: (message) => webSocketService.broadcast(message),
  getClientCount: () => webSocketService.getClientCount(),
  shutdown: () => webSocketService.shutdown()
};