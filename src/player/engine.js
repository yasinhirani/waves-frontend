/**
 * Audio engine – lives OUTSIDE React on purpose.
 *
 * Why: when a PWA is in the background / the screen is locked, browsers throttle or freeze timers and
 * React's scheduler. If "track ended -> next track" had to go through a React render + effect, it would
 * stall and the next song would never start. Here every transition happens synchronously inside the
 * media events / lock-screen handlers:
 *
 *   ended ─► store.next() ─► (store.subscribe, synchronous) ─► audio.src / play()
 *
 * Two <audio> elements are used: while one plays, the other pre-loads the upcoming track and is swapped in
 * on `ended` (near gap-less). If the browser refuses to start the pre-loaded element (autoplay rules),
 * we fall back to re-using the first element, which always works.
 */
import { usePlayerStore } from '../store/playerStore';
import { usePlaybackStore } from '../store/playbackStore';
import { artistText, getImage, pickDownloadUrl } from '../utils/format';
import { attachAdaptiveBitrate } from './adaptive';

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const PRELOAD_AFTER_SECONDS = 3;
const POSITION_KEY = 'waves-position';

const store = usePlayerStore;
const playback = usePlaybackStore;
const state = () => store.getState();

const createElement = () => {
  const a = new Audio();
  a.preload = 'auto';
  a.setAttribute('playsinline', '');
  return a;
};

const players = [createElement(), createElement()];
let cur = 0;
export const getAudio = () => players[cur];
const spare = () => players[1 - cur];

let curSongId = null;
let curQuality = null;
let preloaded = null; // { songId, url, quality } loaded into spare()
let unlocked = false;
let errorStreak = 0;
let lastSaved = 0;
let pendingResume = readPosition();
let adaptive = null;

/* ---------------- persistence of the playback position ---------------- */
function readPosition() {
  try {
    return JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
  } catch {
    return null;
  }
}
function savePosition(force = false) {
  if (!curSongId) return;
  const now = Date.now();
  if (!force && now - lastSaved < 5000) return;
  lastSaved = now;
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify({ id: curSongId, t: getAudio().currentTime || 0 }));
  } catch {
    /* ignore */
  }
}

/* ---------------- helpers ---------------- */
function setSource(a, url, resumeAt = 0) {
  a.src = url;
  if (resumeAt > 0) {
    a.addEventListener(
      'loadedmetadata',
      () => {
        a.currentTime = resumeAt;
      },
      { once: true }
    );
  }
}

function safePlay(a) {
  let p;
  try {
    p = a.play();
  } catch {
    return;
  }
  p?.catch?.((err) => {
    if (err?.name === 'AbortError' || a !== getAudio()) return;
    state().setPlaying(false); // e.g. NotAllowedError – reflect reality in the UI
  });
}

/** Called inside a user gesture: lets iOS/Safari use the spare element later without another tap. */
function unlockSpare() {
  unlocked = true;
  try {
    const a = spare();
    a.src = SILENT_WAV;
    const p = a.play();
    a.pause();
    p?.catch?.(() => {});
  } catch {
    /* ignore */
  }
}

function applyVolume() {
  const { volume, muted } = state();
  players.forEach((a) => {
    a.volume = volume;
    a.muted = muted;
  });
}

/* ---------------- Media Session (lock screen / notification / headset) ---------------- */
const hasMediaSession = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator;

function updateMediaSession(song) {
  if (!hasMediaSession() || typeof MediaMetadata === 'undefined') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: artistText(song),
      album: song.more_info?.album || '',
      artwork: [
        { src: getImage(song.image, '150x150'), sizes: '150x150', type: 'image/jpeg' },
        { src: getImage(song.image, '500x500'), sizes: '500x500', type: 'image/jpeg' }
      ]
    });
  } catch {
    /* invalid artwork url etc. */
  }
}

function updatePositionState() {
  if (!hasMediaSession()) return;
  const a = getAudio();
  if (!Number.isFinite(a.duration) || a.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: a.duration,
      playbackRate: a.playbackRate || 1,
      position: Math.min(a.currentTime, a.duration)
    });
  } catch {
    /* ignore */
  }
}

function setupMediaSession() {
  if (!hasMediaSession()) return;
  const ms = navigator.mediaSession;
  const actions = {
    play: () => state().setPlaying(true),
    pause: () => state().setPlaying(false),
    previoustrack: () => previous(),
    nexttrack: () => state().next(),
    seekto: (d) => d.seekTime != null && seekTo(d.seekTime),
    seekbackward: (d) => seekTo(Math.max(0, getAudio().currentTime - (d.seekOffset || 10))),
    seekforward: (d) => seekTo(getAudio().currentTime + (d.seekOffset || 10))
  };
  Object.entries(actions).forEach(([k, fn]) => {
    try {
      ms.setActionHandler(k, fn);
    } catch {
      /* unsupported action */
    }
  });
}

/* ---------------- loading / switching tracks ---------------- */
function stopAll() {
  curSongId = null;
  preloaded = null;
  players.forEach((a) => {
    a.pause();
    a.removeAttribute('src');
    a.load();
  });
  playback.setState({ time: 0, duration: 0, buffering: false, error: '' });
}

function loadCurrent() {
  const { queue, index, quality, isPlaying } = state();
  const song = queue[index];
  if (!song) return stopAll();
  if (song.id === curSongId) return;
  const url = pickDownloadUrl(song.downloadUrl, quality);
  if (!url) return;

  if (isPlaying && !unlocked) unlockSpare();
  curSongId = song.id;
  updateMediaSession(song);
  adaptive?.reset();

  if (preloaded && preloaded.songId === song.id) return swapToPreloaded();

  const a = getAudio();
  const resumeAt = pendingResume && pendingResume.id === song.id ? pendingResume.t || 0 : 0;
  pendingResume = null;
  preloaded = null;
  curQuality = quality;
  setSource(a, url, resumeAt);
  playback.setState({ activeQuality: quality, time: resumeAt, duration: 0, buffering: isPlaying, error: '' });
  if (isPlaying) safePlay(a);
}

function swapToPreloaded() {
  const pre = preloaded;
  preloaded = null;
  const outgoing = getAudio();
  const incoming = spare();
  cur = 1 - cur;
  curQuality = pre.quality;
  playback.setState({
    activeQuality: pre.quality,
    time: 0,
    duration: Number.isFinite(incoming.duration) ? incoming.duration : 0,
    buffering: false,
    error: ''
  });

  outgoing.pause();
  const release = () => {
    outgoing.removeAttribute('src');
    outgoing.load();
  };
  if (!state().isPlaying) return release();

  let started;
  try {
    started = incoming.play();
  } catch (err) {
    started = Promise.reject(err);
  }
  Promise.resolve(started).then(release, (err) => {
    if (err?.name === 'AbortError') return;
    // The browser refused the pre-loaded element -> go back to the element that is already allowed to play
    cur = 1 - cur;
    incoming.removeAttribute('src');
    incoming.load();
    setSource(outgoing, pre.url, 0);
    safePlay(outgoing);
  });
}

function maybePreload() {
  const { queue, upNext, quality, repeat } = state();
  if (!curSongId || upNext < 0 || repeat === 'one') return;
  if (typeof navigator !== 'undefined' && navigator.connection?.saveData) return;
  const next = queue[upNext];
  if (!next || next.id === curSongId || preloaded?.songId === next.id) return;
  const url = pickDownloadUrl(next.downloadUrl, quality);
  if (!url) return;
  const a = spare();
  a.preload = 'auto';
  a.src = url;
  preloaded = { songId: next.id, url, quality };
}

/* ---------------- public actions ---------------- */
export function seekTo(seconds) {
  const a = getAudio();
  a.currentTime = seconds;
  playback.setState({ time: seconds });
  updatePositionState();
}

export function previous() {
  const a = getAudio();
  if (a.currentTime > 3) seekTo(0);
  else state().prev();
}

/** Drop to a lower bitrate for the current track, keeping the playback position. */
export function stepDownQuality(q) {
  const { queue, index, isPlaying } = state();
  const song = queue[index];
  if (!song) return;
  const a = getAudio();
  const resumeAt = a.currentTime;
  curQuality = q;
  playback.setState({ activeQuality: q, buffering: true });
  setSource(a, pickDownloadUrl(song.downloadUrl, q), resumeAt);
  if (isPlaying) safePlay(a);
  preloaded = null; // it was fetched at the old quality
  maybePreload();
}

/* ---------------- audio events ---------------- */
function bindElementEvents(a) {
  const isCurrent = () => a === getAudio();

  a.addEventListener('timeupdate', () => {
    if (!isCurrent()) return;
    playback.setState({ time: a.currentTime, duration: a.duration || 0 });
    savePosition();
    if (a.currentTime > PRELOAD_AFTER_SECONDS) maybePreload();
  });
  a.addEventListener('loadedmetadata', () => {
    if (!isCurrent()) return;
    playback.setState({ duration: a.duration || 0 });
    updatePositionState();
  });
  a.addEventListener('waiting', () => isCurrent() && playback.setState({ buffering: true }));
  a.addEventListener('canplay', () => isCurrent() && playback.setState({ buffering: false }));
  a.addEventListener('playing', () => {
    if (!isCurrent()) return;
    errorStreak = 0;
    playback.setState({ buffering: false, error: '' });
    updatePositionState();
  });
  a.addEventListener('seeked', () => isCurrent() && updatePositionState());

  // OS-initiated pause/resume (headset unplugged, phone call…) -> keep the UI truthful
  a.addEventListener('pause', () => {
    if (!isCurrent() || a.ended || a.seeking) return;
    if (state().isPlaying) state().setPlaying(false);
  });
  a.addEventListener('play', () => {
    if (isCurrent() && !state().isPlaying) state().setPlaying(true);
  });

  a.addEventListener('ended', () => {
    if (!isCurrent()) return;
    const { repeat, queue } = state();
    if (repeat === 'one' || (repeat === 'all' && queue.length === 1)) {
      a.currentTime = 0;
      safePlay(a);
      return;
    }
    state().next(true); // synchronous chain: store -> subscriber -> src/play (no React involved)
  });

  a.addEventListener('error', () => {
    if (a === spare()) {
      preloaded = null; // a failed pre-load simply falls back to a normal load later
      return;
    }
    if (!isCurrent() || !a.getAttribute('src')) return;
    errorStreak += 1;
    playback.setState({ buffering: false, error: "Couldn't play this track" });
    if (errorStreak < state().queue.length) setTimeout(() => state().next(true), 1200);
    else state().setPlaying(false);
  });
}

/* ---------------- init ---------------- */
function init() {
  players.forEach(bindElementEvents);

  store.subscribe((s, p) => {
    if (s.queue !== p.queue || s.index !== p.index) loadCurrent();
    if (s.isPlaying !== p.isPlaying) {
      const a = getAudio();
      if (a.getAttribute('src')) {
        if (s.isPlaying) {
          if (!unlocked) unlockSpare();
          safePlay(a);
        } else {
          a.pause();
        }
      }
      if (hasMediaSession()) navigator.mediaSession.playbackState = s.isPlaying ? 'playing' : 'paused';
    }
    if (s.volume !== p.volume || s.muted !== p.muted) applyVolume();
    if (s.upNext !== p.upNext && getAudio().currentTime > PRELOAD_AFTER_SECONDS) maybePreload();
  });

  adaptive = attachAdaptiveBitrate({
    elements: players,
    getCurrent: getAudio,
    getActiveQuality: () => curQuality ?? state().quality,
    stepDown: stepDownQuality
  });

  setupMediaSession();
  applyVolume();
  try {
    // iOS 17+: treat the page as a media-playback session (plays with the silent switch on, survives backgrounding)
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) navigator.audioSession.type = 'playback';
  } catch {
    /* ignore */
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => savePosition(true));
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && savePosition(true));
  }

  // Restore the last queue/track (paused) after the OS killed the app
  if (state().queue[state().index]) loadCurrent();
}

init();
if (import.meta.hot) import.meta.hot.decline(); // never hot-patch the engine (would duplicate listeners)
