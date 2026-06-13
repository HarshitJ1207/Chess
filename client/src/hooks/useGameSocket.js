import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/game`;

export function useGameSocket(gameId, token, onMessage) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  useEffect(() => {
    if (!gameId || !token) return;

    const ws = new WebSocket(`${WS_BASE}/${gameId}?token=${token}`);
    wsRef.current = ws;

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        onMessageRef.current(msg);
      } catch {
        // ignore malformed frames
      }
    });

    ws.addEventListener('error', () => {
      onMessageRef.current({ t: '_error' });
    });

    ws.addEventListener('close', () => {
      onMessageRef.current({ t: '_close' });
    });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [gameId, token]);

  return { send };
}
