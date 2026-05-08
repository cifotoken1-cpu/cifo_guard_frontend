import { WS_URL } from '../config';

let ws = null;
const handlers = new Set();

export function connectWs() {
  const url = WS_URL.replace(/^http/, 'ws');
  ws = new WebSocket(url);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handlers.forEach((h) => h(msg));
    } catch {
      // ignore non-JSON frames
    }
  };

  ws.onclose = () => {
    setTimeout(connectWs, 3_000);
  };

  ws.onerror = () => {
    // eslint-disable-next-line no-console
    console.warn('[ws] connection error — will retry in 3s');
  };
}

export function disconnectWs() {
  ws?.close();
  ws = null;
}

/** Subscribe to native WebSocket messages. Returns unsubscribe fn. */
export function onWsMessage(handler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}
