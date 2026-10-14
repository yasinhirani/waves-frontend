/**
 * Background-playback regression tests. The engine must advance tracks SYNCHRONOUSLY from media events and
 * lock-screen handlers – no React render, no timers, no awaiting – because a backgrounded PWA throttles those.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const handlers = {};
let engine;
let store;

const mk = (id) => ({
  id, title: `Song ${id}`, subtitle: 'S',
  image: [{ quality: '150x150', url: `https://x/${id}.jpg` }, { quality: '500x500', url: `https://x/${id}.jpg` }],
  more_info: { duration: '200', album: 'Alb', artistMap: { primary_artists: [{ id: 'a' + id, name: 'Artist', token: 't' }] } },
  downloadUrl: [{ quality: '160kbps', url: `https://x/${id}_160.mp4` }]
});
const songs = [mk('1'), mk('2'), mk('3')];

const flush = () => new Promise((r) => setTimeout(r, 0));
const setTime = (a, t) => Object.defineProperty(a, 'currentTime', { value: t, writable: true, configurable: true });
const fire = (a, name) => a.dispatchEvent(new Event(name));
const play = () => HTMLMediaElement.prototype.play;

beforeAll(async () => {
  HTMLMediaElement.prototype.play = vi.fn(function () { return Promise.resolve(); });
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
  globalThis.MediaMetadata = class { constructor(i) { Object.assign(this, i); } };
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: { setActionHandler: (k, fn) => { handlers[k] = fn; }, metadata: null, playbackState: 'none', setPositionState() {} }
  });
  engine = await import('../src/player/engine');
  ({ usePlayerStore: store } = await import('../src/store/playerStore'));
});

beforeEach(() => {
  play().mockClear();
  play().mockImplementation(function () { return Promise.resolve(); });
  store.setState({ queue: [], index: -1, upNext: -1, isPlaying: false, repeat: 'off', shuffle: false });
});

describe('background-safe track changes', () => {
  it('advances to the next track synchronously when a track ends', () => {
    store.getState().playQueue(songs, 0);
    const a = engine.getAudio();
    expect(a.src).toContain('1_160');
    fire(a, 'ended'); // <- no await, no act: everything must already have happened
    expect(engine.getAudio().src).toContain('2_160');
    expect(store.getState().index).toBe(1);
    expect(store.getState().isPlaying).toBe(true);
  });

  it('pre-loads the next track and plays that element on ended (near gap-less)', () => {
    store.getState().playQueue(songs, 0);
    const a = engine.getAudio();
    setTime(a, 5);
    fire(a, 'timeupdate'); // > 3s in -> pre-load kicks in
    const preloadEl = [...new Set(play().mock.contexts)].find((el) => el !== a) ?? null;
    fire(a, 'ended');
    const now = engine.getAudio();
    expect(now).not.toBe(a);
    expect(now.src).toContain('2_160');
    expect(play().mock.contexts.at(-1)).toBe(now);
    expect(preloadEl === null || preloadEl === now || preloadEl !== a).toBe(true);
  });

  it('falls back to the original element when the browser rejects the pre-loaded one', async () => {
    store.getState().playQueue(songs, 0);
    const a = engine.getAudio();
    setTime(a, 5);
    fire(a, 'timeupdate');
    play().mockImplementation(function () {
      return this === a ? Promise.resolve() : Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    });
    fire(a, 'ended');
    await flush();
    expect(engine.getAudio()).toBe(a);
    expect(a.src).toContain('2_160');
    expect(store.getState().isPlaying).toBe(true);
  });

  it('lock-screen "next" and "previous" work synchronously', () => {
    store.getState().playQueue(songs, 0);
    handlers.nexttrack();
    expect(engine.getAudio().src).toContain('2_160');
    setTime(engine.getAudio(), 0);
    handlers.previoustrack();
    expect(engine.getAudio().src).toContain('1_160');
  });

  it('keeps the lock-screen metadata and playback state in sync', () => {
    store.getState().playQueue(songs, 1);
    expect(navigator.mediaSession.metadata.title).toBe('Song 2');
    expect(navigator.mediaSession.playbackState).toBe('playing');
    handlers.pause();
    expect(store.getState().isPlaying).toBe(false);
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });

  it('shuffle: pre-loads exactly the track that will play next', () => {
    store.getState().toggleShuffle();
    store.getState().playQueue(songs, 0);
    const planned = store.getState().upNext;
    expect(planned).toBeGreaterThanOrEqual(0);
    const a = engine.getAudio();
    setTime(a, 5);
    fire(a, 'timeupdate');
    fire(a, 'ended');
    expect(store.getState().index).toBe(planned);
    expect(engine.getAudio().src).toContain(`${songs[planned].id}_160`);
  });
});

describe('end of queue, repeat and OS interruptions', () => {
  it('stops after the last track when repeat is off', () => {
    store.getState().playQueue(songs, 2);
    fire(engine.getAudio(), 'ended');
    expect(store.getState().isPlaying).toBe(false);
    expect(store.getState().index).toBe(2);
  });

  it('wraps to the first track when repeat is "all"', () => {
    store.getState().cycleRepeat(); // all
    store.getState().playQueue(songs, 2);
    fire(engine.getAudio(), 'ended');
    expect(store.getState().index).toBe(0);
    expect(engine.getAudio().src).toContain('1_160');
  });

  it('restarts the same track when repeat is "one"', () => {
    store.getState().cycleRepeat();
    store.getState().cycleRepeat(); // one
    store.getState().playQueue(songs, 1);
    const a = engine.getAudio();
    setTime(a, 90);
    fire(a, 'ended');
    expect(a.currentTime).toBe(0);
    expect(a.src).toContain('2_160');
    expect(store.getState().index).toBe(1);
  });

  it('shows "paused" when the OS pauses audio, but not at a natural end of track', () => {
    store.getState().playQueue(songs, 0);
    const a = engine.getAudio();
    Object.defineProperty(a, 'ended', { value: true, configurable: true });
    fire(a, 'pause'); // browsers fire "pause" right before "ended"
    expect(store.getState().isPlaying).toBe(true);
    Object.defineProperty(a, 'ended', { value: false, configurable: true });
    fire(a, 'pause'); // e.g. headphones unplugged / incoming call
    expect(store.getState().isPlaying).toBe(false);
  });

  it('remembers the playback position when the page is hidden/closed', () => {
    store.getState().playQueue(songs, 0);
    const a = engine.getAudio();
    setTime(a, 42);
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(localStorage.getItem('waves-position'))).toEqual({ id: '1', t: 42 });
  });
});

describe('podcast (single-source) tracks', () => {
  const ep = (id) => ({ ...mk(id), downloadUrl: ['12', '48', '96', '160', '320'].map((b) => ({ quality: `${b}kbps`, url: `https://hub/${id}.mp3` })) });

  it('reports "original" quality and ignores stalls (nothing lower to switch to)', async () => {
    const { usePlaybackStore } = await import('../src/store/playbackStore');
    store.getState().playQueue([ep('p1'), ep('p2')], 0);
    const a = engine.getAudio();
    expect(usePlaybackStore.getState().activeQuality).toBe('original');
    const before = store.getState().quality;
    setTime(a, 5);
    fire(a, 'waiting');
    fire(a, 'waiting');
    fire(a, 'waiting');
    expect(a.src).toContain('p1.mp3'); // not reloaded
    expect(store.getState().quality).toBe(before); // music quality untouched by podcast stalls
  });

  it('uses the show title for the lock-screen album', () => {
    store.getState().playQueue([{ ...ep('p3'), more_info: { ...mk('p3').more_info, album: undefined, show_title: 'My Show' } }], 0);
    expect(navigator.mediaSession.metadata.album).toBe('My Show');
  });
});

describe('radio stations: continuous, no visible queue, tops itself up', () => {
  const rsong = (id) => mk(id);

  beforeEach(() => {
    store.setState({ queue: [], index: -1, upNext: -1, isPlaying: false, isRadio: false, radioStationId: null });
  });

  it('starts playing the first song immediately, like a normal queue of one station', () => {
    store.getState().playRadio('STID1', [rsong('a'), rsong('b')]);
    expect(engine.getAudio().src).toContain('a_160');
    expect(store.getState().isPlaying).toBe(true);
    expect(store.getState().isRadio).toBe(true);
  });

  it('fetches more songs once the LAST queued track is playing, and appends them without interrupting playback', async () => {
    const fetchMore = vi.spyOn(await import('../src/api/music'), 'fetchMoreRadioSongs').mockResolvedValue([rsong('c'), rsong('d')]);
    store.getState().playRadio('STID1', [rsong('a'), rsong('b')]);
    const a = engine.getAudio();
    setTime(a, 1); // not yet the last track being neared -> still only 2 in queue
    fire(a, 'timeupdate');
    expect(fetchMore).not.toHaveBeenCalled();

    handlers.nexttrack(); // now on the LAST queued track ("b")
    setTime(engine.getAudio(), 5);
    fire(engine.getAudio(), 'timeupdate');
    expect(fetchMore).toHaveBeenCalledWith('STID1');
    await flush();
    expect(store.getState().queue.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);

    // ended -> continues synchronously into the newly appended song, same as any other track change
    fire(engine.getAudio(), 'ended');
    expect(store.getState().index).toBe(2);
    expect(engine.getAudio().src).toContain('c_160');
    expect(store.getState().isPlaying).toBe(true);
    fetchMore.mockRestore();
  });

  it('does not fetch again while a fetch is already in flight, and drops duplicate songs the station resends', async () => {
    const api = await import('../src/api/music');
    let resolveFetch;
    const fetchMore = vi.spyOn(api, 'fetchMoreRadioSongs').mockImplementation(() => new Promise((r) => { resolveFetch = r; }));
    store.getState().playRadio('STID1', [rsong('a')]);
    const a = engine.getAudio();
    setTime(a, 5);
    fire(a, 'timeupdate');
    fire(a, 'timeupdate'); // still on the last track, still in flight -> must not fire a second request
    expect(fetchMore).toHaveBeenCalledTimes(1);
    resolveFetch([rsong('a'), rsong('e')]); // "a" is a duplicate of what's already queued
    await flush();
    expect(store.getState().queue.map((s) => s.id)).toEqual(['a', 'e']);
    fetchMore.mockRestore();
  });

  it('stops gracefully (no crash) if the "more songs" request fails', async () => {
    const api = await import('../src/api/music');
    const fetchMore = vi.spyOn(api, 'fetchMoreRadioSongs').mockRejectedValue(new Error('network'));
    store.getState().playRadio('STID1', [rsong('a')]);
    const a = engine.getAudio();
    setTime(a, 5);
    fire(a, 'timeupdate');
    await flush();
    expect(store.getState().queue).toHaveLength(1); // nothing appended
    fire(a, 'ended'); // nothing queued after it -> playback just stops, same as end of a normal queue
    expect(store.getState().isPlaying).toBe(false);
    fetchMore.mockRestore();
  });

  it('starting a normal queue or shuffle afterwards clears radio mode', () => {
    store.getState().playRadio('STID1', [rsong('a'), rsong('b')]);
    expect(store.getState().isRadio).toBe(true);
    store.getState().playQueue([rsong('x'), rsong('y')], 0);
    expect(store.getState().isRadio).toBe(false);
    expect(store.getState().radioStationId).toBeNull();
  });
});
