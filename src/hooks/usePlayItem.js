import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queries } from '../api/queries';
import { usePlayerStore } from '../store/playerStore';
import { toast } from '../store/toastStore';
import { getToken, hasAudio } from '../utils/format';

/** Returns play(item): starts playback for a song / album / playlist card. */
export function usePlayItem() {
  const qc = useQueryClient();
  const playQueue = usePlayerStore((s) => s.playQueue);

  return useCallback(
    async (item) => {
      const token = getToken(item);
      try {
        let songs = [];
        if (item.type === 'song') {
          songs = [hasAudio(item) ? item : await qc.fetchQuery(queries.song(token))];
        } else if (item.type === 'album') {
          songs = (await qc.fetchQuery(queries.album(token))).list ?? [];
        } else if (item.type === 'playlist') {
          songs = (await qc.fetchQuery(queries.playlistFirstPage(token))).list ?? [];
        }
        if (!songs.some(hasAudio)) return toast.error('Nothing playable here');
        playQueue(songs, 0);
      } catch (err) {
        toast.error(err.message || 'Unable to start playback');
      }
    },
    [qc, playQueue]
  );
}
