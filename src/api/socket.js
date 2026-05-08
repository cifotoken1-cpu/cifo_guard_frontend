import { io } from 'socket.io-client';
import { WS_URL, WS_ROOMS } from '../config';
import { useAuthStore } from '../store/auth.store';

let socket = null;

/** Get (and lazily init) the socket singleton. */
export function getSocket() {
  if (socket) return socket;

  socket = io(WS_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
  });

  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[socket] connected', socket.id);

    const token = useAuthStore.getState().token;
    if (token) socket.emit('authenticate', { token });

    // Join all relevant rooms
    WS_ROOMS.forEach((room) => socket.emit('join_room', room));
  });

  socket.on('authenticated', () => {
    // eslint-disable-next-line no-console
    console.log('[socket] authenticated');
  });

  socket.on('disconnect', (reason) => {
    // eslint-disable-next-line no-console
    console.log('[socket] disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[socket] connect_error:', err.message);
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

/**
 * Subscribe to one or more events. Returns unsubscribe fn.
 * Safer than calling socket.on/off directly in components.
 */
export function onSocket(events, handler) {
  const s = getSocket();
  const list = Array.isArray(events) ? events : [events];
  list.forEach((evt) => s.on(evt, handler));
  return () => list.forEach((evt) => s.off(evt, handler));
}
