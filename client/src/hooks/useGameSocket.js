import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/game`;
const SEND_QUEUE_LIMIT = 50;
const PING_INTERVAL_MS = 30000;

export function useGameSocket(gameId, token, onMessage) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const connectionIdRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  // Messages sent while the socket is down are buffered here and flushed on open,
  // so a move made during a reconnect is never silently lost.
  const sendQueueRef = useRef([]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  /**
   * Sends a frame immediately if the socket is OPEN, otherwise buffers it for the
   * next (re)connection. Returns 'sent' | 'queued' | 'dropped' so callers can tag
   * optimistic UI updates appropriately.
   */
  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return 'sent';
    }
    if (ws?.readyState === WebSocket.CONNECTING || wsRef.current === null) {
      // CONNECTING (reconnect in progress) or no socket yet (reconnect scheduled).
      if (sendQueueRef.current.length >= SEND_QUEUE_LIMIT) {
        sendQueueRef.current.shift(); // bound memory; oldest stale actions go first
      }
      sendQueueRef.current.push(JSON.stringify(obj));
      return 'queued';
    }
    return 'dropped';
  }, []);

  useEffect(() => {
    if (!gameId || !token) return;

    let isActive = true;

    function flushQueue(ws) {
      const queue = sendQueueRef.current;
      sendQueueRef.current = [];
      for (const payload of queue) {
        ws.send(payload);
      }
    }

    function startPing(ws) {
      stopPing();
      pingTimerRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          // Server replies with {t:'pong'}; primarily keeps nginx/gateway timeouts happy.
          ws.send(JSON.stringify({ t: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    }

    function stopPing() {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    }

    function connect() {
      if (!isActive) return;

      const connectionId = connectionIdRef.current + 1;
      connectionIdRef.current = connectionId;

      const ws = new WebSocket(`${WS_BASE}/${gameId}?token=${token}`);
      wsRef.current = ws;
      onMessageRef.current({ t: '_connecting' });

      const emit = (msg) => {
        if (connectionIdRef.current === connectionId && wsRef.current === ws) {
          onMessageRef.current(msg);
        }
      };

      ws.addEventListener('open', () => {
        flushQueue(ws);
        startPing(ws);
        emit({ t: '_open' });
      });

      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          emit(msg);
        } catch {
          // ignore malformed frames
        }
      });

      ws.addEventListener('error', () => {
        emit({ t: '_error' });
      });

      ws.addEventListener('close', () => {
        if (connectionIdRef.current !== connectionId || wsRef.current !== ws) {
          return;
        }

        stopPing();
        onMessageRef.current({ t: '_close' });
        wsRef.current = null;

        if (isActive) {
          reconnectTimerRef.current = window.setTimeout(connect, 1000);
        }
      });
    }

    connect();

    return () => {
      isActive = false;
      connectionIdRef.current += 1;
      window.clearTimeout(reconnectTimerRef.current);
      stopPing();
      sendQueueRef.current = [];

      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [gameId, token]);

  return { send };
}
