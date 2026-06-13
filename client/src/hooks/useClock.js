import { useState, useRef, useEffect, useCallback } from 'react';

const SNAP_THRESHOLD_MS = 500;
const SMEAR_RATE = 0.05;

export function useClock() {
  const [whiteMs, setWhiteMs] = useState(null);
  const [blackMs, setBlackMs] = useState(null);
  const activeColorRef = useRef(null);
  const baselineRef = useRef(null); // { color, serverMs, localTs }
  const rafRef = useRef(null);

  const tick = useCallback(() => {
    if (!baselineRef.current) return;
    const { color, serverMs, localTs } = baselineRef.current;
    const elapsed = Date.now() - localTs;
    const remaining = Math.max(0, serverMs - elapsed);

    if (color === 'white') setWhiteMs(remaining);
    else setBlackMs(remaining);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const sync = useCallback((clock, activeColor) => {
    // clock: { white: seconds, black: seconds }
    cancelAnimationFrame(rafRef.current);
    activeColorRef.current = activeColor;

    const whiteMsNew = Math.round(clock.white * 1000);
    const blackMsNew = Math.round(clock.black * 1000);

    setWhiteMs((prev) => {
      if (prev === null) return whiteMsNew;
      const drift = Math.abs(prev - whiteMsNew);
      return drift > SNAP_THRESHOLD_MS ? whiteMsNew : prev + (whiteMsNew - prev) * SMEAR_RATE;
    });
    setBlackMs((prev) => {
      if (prev === null) return blackMsNew;
      const drift = Math.abs(prev - blackMsNew);
      return drift > SNAP_THRESHOLD_MS ? blackMsNew : prev + (blackMsNew - prev) * SMEAR_RATE;
    });

    if (activeColor) {
      const serverMs = activeColor === 'white' ? whiteMsNew : blackMsNew;
      baselineRef.current = { color: activeColor, serverMs, localTs: Date.now() };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      baselineRef.current = null;
    }
  }, [tick]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { whiteMs, blackMs, sync };
}

export function formatClock(ms) {
  if (ms === null) return '--:--';
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
