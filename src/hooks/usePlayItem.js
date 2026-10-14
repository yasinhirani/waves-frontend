import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queries } from '../api/queries';
import { startRadioStation } from '../api/music';
import { usePlayerStore } from '../store/playerStore';
import { toast } from '../store/toastStore';
import { getToken, hasAudio } from '../utils/format';

/** Returns play(item): starts playback for a song / album / playlist card. */
export function usePlayItem() {
  const qc = useQueryClient();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const playRadio = usePlayerStore((s) => s.playRadio);

  return useCallback(
    async (item) => {
      if (item.type === 'radio_station') {
        try {
          const { stationId, songs } = await startRadioStation(item.title || item.name, item.more_info?.language);
          if (!songs.some(hasAudio)) return toast.error('Nothing playable here');
          playRadio(stationId, songs);
        } catch (err) {
          toast.error(err.message || 'Unable to start this station');
        }
        return;
      }
      const token = getToken(item);
      try {
        let songs = [];
        if (item.type === 'song') {
          songs = [hasAudio(item) ? item : await qc.fetchQuery(queries.song(token))];
        } else if (item.type === 'album') {
          songs = (await qc.fetchQuery(queries.album(token))).list ?? [];
        } else if (item.type === 'show') {
          songs = (await qc.fetchQuery(queries.podcast(token, 1))).episodes ?? [];
        } else if (item.type === 'playlist') {
          songs = (await qc.fetchQuery(queries.playlistFirstPage(token))).list ?? [];
        }
        if (!songs.some(hasAudio)) return toast.error('Nothing playable here');
        playQueue(songs, 0);
      } catch (err) {
        toast.error(err.message || 'Unable to start playback');
      }
    },
    [qc, playQueue, playRadio]
  );
}
