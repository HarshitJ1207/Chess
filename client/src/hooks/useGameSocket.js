import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/game`;

export function useGameSocket(gameId, token, onMessage) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const connectionIdRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const send = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  useEffect(() => {
    if (!gameId || !token) return;

    let isActive = true;

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

      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [gameId, token]);

  return { send };
}
