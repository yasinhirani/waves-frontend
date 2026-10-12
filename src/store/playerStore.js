import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { hasAudio } from '../utils/format';
import { qualityFromConnection } from '../utils/adaptive';

const randomIndex = (length, exclude) => {
  if (length <= 1) return 0;
  let i;
  do i = Math.floor(Math.random() * length);
  while (i === exclude);
  return i;
};

/** Index of the track that follows `index` automatically (-1 = nothing). Decided up-front so it can be pre-loaded. */
export const planNext = (length, index, shuffle, repeat) => {
  if (length === 0 || index < 0) return -1;
  if (shuffle && length > 1) return randomIndex(length, index);
  if (index + 1 < length) return index + 1;
  return repeat === 'all' ? 0 : -1;
};

// localStorage can throw (private mode / quota) – never let that break playback state updates
const safeStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
};

const MAX_PERSISTED_QUEUE = 100;

export const usePlayerStore = create(
  persist(
    (set, get) => {
      // every change to queue/index/shuffle/repeat re-plans the next track in the SAME update
      const commit = (partial) => {
        const s = { ...get(), ...partial };
        set({ ...partial, upNext: planNext(s.queue.length, s.index, s.shuffle, s.repeat) });
      };

      return {
        queue: [],
        index: -1,
        upNext: -1,
        isPlaying: false,
        volume: 0.8,
        muted: false,
        quality: qualityFromConnection(), // target for upcoming tracks; managed automatically
        shuffle: false,
        repeat: 'off', // 'off' | 'all' | 'one'

        playQueue: (songs, startIndex = 0) => {
          const playable = songs.filter(hasAudio);
          if (!playable.length) return;
          const startId = songs[startIndex]?.id;
          const idx = Math.max(0, playable.findIndex((s) => s.id === startId));
          commit({ queue: playable, index: idx, isPlaying: true });
        },

        playShuffled: (songs) => {
          const playable = songs.filter(hasAudio);
          if (!playable.length) return;
          commit({ queue: playable, index: randomIndex(playable.length, -1), isPlaying: true, shuffle: true });
        },

        togglePlay: () => {
          if (get().index < 0) return;
          set((s) => ({ isPlaying: !s.isPlaying }));
        },
        setPlaying: (isPlaying) => set({ isPlaying }),

        next: (auto = false) => {
          const { queue, upNext } = get();
          if (!queue.length) return;
          const target = upNext >= 0 ? upNext : auto ? -1 : 0; // manual "next" at the end wraps around
          if (target < 0) return set({ isPlaying: false });
          commit({ index: target, isPlaying: true });
        },

        prev: () => {
          const { queue, index, repeat } = get();
          if (!queue.length) return;
          const target = index > 0 ? index - 1 : repeat === 'all' ? queue.length - 1 : 0;
          commit({ index: target, isPlaying: true });
        },

        setVolume: (volume) => set({ volume, muted: volume === 0 }),
        toggleMute: () => set((s) => ({ muted: !s.muted })),
        setQuality: (quality) => set({ quality }),
        toggleShuffle: () => commit({ shuffle: !get().shuffle }),
        cycleRepeat: () => {
          const r = get().repeat;
          commit({ repeat: r === 'off' ? 'all' : r === 'all' ? 'one' : 'off' });
        }
      };
    },
    {
      name: 'waves-player',
      storage: createJSONStorage(() => safeStorage),
      // the queue is persisted so the app can restore the last track after the OS kills the PWA
      partialize: (s) => {
        let { queue, index } = s;
        if (queue.length > MAX_PERSISTED_QUEUE) {
          const start = Math.min(Math.max(0, index - 10), queue.length - MAX_PERSISTED_QUEUE);
          queue = queue.slice(start, start + MAX_PERSISTED_QUEUE);
          index -= start;
        }
        return { volume: s.volume, muted: s.muted, shuffle: s.shuffle, repeat: s.repeat, queue, index };
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...persisted, quality: current.quality, isPlaying: false };
        if (!Array.isArray(merged.queue) || merged.index >= merged.queue.length) {
          merged.queue = [];
          merged.index = -1;
        }
        merged.upNext = planNext(merged.queue.length, merged.index, merged.shuffle, merged.repeat);
        return merged;
      }
    }
  )
);
