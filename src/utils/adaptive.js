// Adaptive bitrate helpers (pure functions – easy to unit test)

export const QUALITY_LADDER = ['48kbps', '96kbps', '160kbps', '320kbps'];
export const DEFAULT_QUALITY = '160kbps';

export const bitrateOf = (quality) => parseInt(quality, 10) || 160;

const indexOf = (q) => Math.max(0, QUALITY_LADDER.indexOf(q));
export const stepDown = (q) => QUALITY_LADDER[Math.max(0, indexOf(q) - 1)];
export const stepUp = (q) => QUALITY_LADDER[Math.min(QUALITY_LADDER.length - 1, indexOf(q) + 1)];
export const isHigher = (a, b) => indexOf(a) > indexOf(b);

/** Highest bitrate whose required speed (bitrate × headroom) fits in `kbps`. */
export function qualityFromKbps(kbps, headroom) {
  let pick = QUALITY_LADDER[0];
  for (const q of QUALITY_LADDER) if (bitrateOf(q) * headroom <= kbps) pick = q;
  return pick;
}

/**
 * Initial guess from the Network Information API (Chrome / Edge / Android).
 * Browsers without it (Safari, Firefox) get the default and rely on measuring.
 */
export function qualityFromConnection(conn = typeof navigator !== 'undefined' ? navigator.connection : undefined) {
  if (!conn) return DEFAULT_QUALITY;
  if (conn.saveData) return QUALITY_LADDER[0];
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return QUALITY_LADDER[0];
  if (conn.effectiveType === '3g') return '96kbps';
  if (typeof conn.downlink === 'number' && conn.downlink > 0) return qualityFromKbps(conn.downlink * 1000, 4);
  return DEFAULT_QUALITY;
}
