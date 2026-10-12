import { usePlayerStore } from '../store/playerStore';
import { bitrateOf, isHigher, qualityFromConnection, qualityFromKbps, stepDown as lower, stepUp } from '../utils/adaptive';

const MIN_SAMPLES = 3; // speed samples needed before raising quality
const RAISE_HEADROOM = 2.5; // measured speed must be 2.5x the bitrate to go up
const STALL_WINDOW_MS = 30_000;
const SLOW_START_MS = 5_000;
const HOLD_AFTER_DROP_MS = 60_000; // no raising for a minute after a drop

/** furthest buffered position around the playhead */
const bufferedEnd = (a) => {
  const r = a.buffered;
  const t = a.currentTime;
  for (let i = 0; i < r.length; i++) if (r.start(i) <= t + 0.5 && r.end(i) >= t) return r.end(i);
  return r.length ? r.end(r.length - 1) : 0;
};

/**
 * Chooses the audio bitrate automatically:
 *  1. start from the connection type (Network Information API, when available)
 *  2. measure real download speed while audio buffers -> raise quality for the NEXT track
 *  3. on repeated stalls / very slow start -> drop quality immediately (keeps playback position)
 * Only events of the element that is currently playing are considered.
 */
export function attachAdaptiveBitrate({ elements, getCurrent, getActiveQuality, stepDown }) {
  const { setQuality } = usePlayerStore.getState();
  const s = { last: null, ema: null, samples: 0, stalls: [], holdUntil: 0, loadStartedAt: null };

  const registerStall = () => {
    const now = performance.now();
    s.stalls = [...s.stalls.filter((t) => now - t < STALL_WINDOW_MS), now];
    if (s.stalls.length < 2) return;
    const current = getActiveQuality();
    const next = lower(current);
    s.stalls = [];
    s.ema = null;
    s.samples = 0;
    s.holdUntil = now + HOLD_AFTER_DROP_MS;
    if (next !== current) {
      setQuality(next);
      stepDown(next);
    }
  };

  const handlersFor = (a) => ({
    loadstart: () => {
      if (a !== getCurrent()) return;
      s.last = null;
      s.loadStartedAt = performance.now();
    },
    playing: () => {
      if (a !== getCurrent() || s.loadStartedAt == null) return;
      const took = performance.now() - s.loadStartedAt;
      s.loadStartedAt = null;
      if (took > SLOW_START_MS && !a.seeking) registerStall(); // very slow start counts as a stall
    },
    waiting: () => {
      if (a !== getCurrent() || a.seeking || a.currentTime < 0.5) return; // ignore normal start-up / seeks
      registerStall();
    },
    progress: () => {
      if (a !== getCurrent()) return;
      const now = performance.now();
      const end = bufferedEnd(a);
      if (!s.last) {
        s.last = { t: now, end };
        return;
      }
      const dt = (now - s.last.t) / 1000;
      if (dt > 4) {
        s.last = { t: now, end }; // idle gap (browser paused downloading) – restart window
        return;
      }
      if (dt < 0.5) return; // wait for a longer window
      const grown = end - s.last.end;
      s.last = { t: now, end };
      if (grown <= 0) return;

      // seconds of audio downloaded per wall-second × bitrate  ≈  throughput in kbps
      const sample = (grown / dt) * bitrateOf(getActiveQuality());
      s.ema = s.ema == null ? sample : s.ema * 0.7 + sample * 0.3;
      s.samples += 1;

      if (s.samples >= MIN_SAMPLES && now >= s.holdUntil) {
        const current = usePlayerStore.getState().quality;
        if (isHigher(qualityFromKbps(s.ema, RAISE_HEADROOM), current)) {
          setQuality(stepUp(current)); // one step at a time, used from the next track
          s.samples = 0;
        }
      }
    }
  });

  const onConnectionChange = () => {
    s.ema = null;
    s.samples = 0;
    s.holdUntil = 0;
    setQuality(qualityFromConnection());
  };

  const bound = elements.map((a) => [a, handlersFor(a)]);
  bound.forEach(([a, h]) => Object.entries(h).forEach(([e, fn]) => a.addEventListener(e, fn)));
  const conn = typeof navigator !== 'undefined' ? navigator.connection : undefined;
  conn?.addEventListener?.('change', onConnectionChange);

  return {
    /** call when playback switches to another element/track */
    reset: () => {
      s.last = null;
      s.loadStartedAt = null;
    },
    detach: () => {
      bound.forEach(([a, h]) => Object.entries(h).forEach(([e, fn]) => a.removeEventListener(e, fn)));
      conn?.removeEventListener?.('change', onConnectionChange);
    }
  };
}
