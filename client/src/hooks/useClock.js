import { useMemo, useSyncExternalStore } from 'react';

const SNAP_THRESHOLD_MS = 500;
const SMEAR_RATE = 0.05;

/**
 * External clock store. GamePage pushes event-driven server syncs into it, and each
 * ClockDisplay subscribes to its own color via useSyncExternalStore. The 60fps
 * requestAnimationFrame ticking happens here — outside React state — so clock ticks
 * re-render only the clock widgets, never the whole GamePage tree.
 */
export function createClockStore() {
  const values = { white: null, black: null };
  const listeners = { white: new Set(), black: new Set() };
  let baseline = null; // { color, serverMs, localTs }
  let rafId = null;

  function notify(color) {
    for (const listener of listeners[color]) listener();
  }

  function tick() {
    if (!baseline) {
      rafId = null;
      return;
    }
    const { color, serverMs, localTs } = baseline;
    const remaining = Math.max(0, serverMs - (Date.now() - localTs));
    if (values[color] !== remaining) {
      values[color] = remaining;
      notify(color);
    }
    rafId = requestAnimationFrame(tick);
  }

  function ensureTicking() {
    if (baseline && rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  /**
   * Sync from a server clock snapshot: { white: seconds, black: seconds }.
   * activeColor starts the rAF countdown for that side; null stops it (game over).
   */
  function sync(clock, activeColor) {
    const whiteNew = Math.round(clock.white * 1000);
    const blackNew = Math.round(clock.black * 1000);

    const smooth = (current, next) => {
      if (current === null || Math.abs(current - next) > SNAP_THRESHOLD_MS) return next;
      return current + (next - current) * SMEAR_RATE;
    };
    values.white = smooth(values.white, whiteNew);
    values.black = smooth(values.black, blackNew);

    baseline = activeColor
      ? { color: activeColor, serverMs: activeColor === 'white' ? whiteNew : blackNew, localTs: Date.now() }
      : null;

    notify('white');
    notify('black');

    if (baseline) {
      ensureTicking();
    } else if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function subscribe(color) {
    return (listener) => {
      listeners[color].add(listener);
      return () => listeners[color].delete(listener);
    };
  }

  function get(color) {
    return () => values[color];
  }

  function destroy() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    baseline = null;
  }

  return { sync, subscribe, get, destroy };
}

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

/** Subscribes a ClockDisplay to one color of the store. */
export function useClockValue(clock, color) {
  const isLiveColor = color === 'white' || color === 'black';
  // Memoized so useSyncExternalStore doesn't resubscribe on every store tick.
  const subscribe = useMemo(
    () => (isLiveColor ? clock.subscribe(color) : noopSubscribe),
    [clock, color, isLiveColor]
  );
  const getSnapshot = useMemo(
    () => (isLiveColor ? clock.get(color) : nullSnapshot),
    [clock, color, isLiveColor]
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function formatClock(ms) {
  if (ms === null) return '--:--';
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
