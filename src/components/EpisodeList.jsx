import { Play } from 'lucide-react';
import { Equalizer } from './SongList';
import { usePlayerStore } from '../store/playerStore';
import { toast } from '../store/toastStore';
import { formatCount, formatDate, formatEpisodeDuration, getImage, hasAudio } from '../utils/format';

export default function EpisodeList({ episodes }) {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);

  const activate = (ep, i) => {
    if (!hasAudio(ep)) return toast.error('This episode is not available');
    if (ep.id === currentId) togglePlay();
    else playQueue(episodes, i);
  };

  return (
    <ul className="song-list">
      {episodes.map((ep, i) => {
        const active = ep.id === currentId;
        const plays = formatCount(ep.play_count);
        const meta = [formatDate(ep.more_info?.release_date), formatEpisodeDuration(ep.more_info?.duration), plays && `${plays} plays`]
          .filter(Boolean)
          .join(' · ');
        return (
          <li
            key={`${ep.id}-${i}`}
            className={`episode-row ${active ? 'active' : ''} ${hasAudio(ep) ? '' : 'disabled'}`}
            role="button"
            tabIndex={0}
            onClick={() => activate(ep, i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') activate(ep, i);
            }}
          >
            <span className="song-index">
              {active && isPlaying ? <Equalizer /> : active ? <Play size={14} fill="currentColor" /> : i + 1}
            </span>
            <img className="song-thumb" src={getImage(ep.image, '150x150')} alt="" loading="lazy" />
            <div className="episode-body">
              <span className="episode-title">{ep.title}</span>
              {meta && <span className="episode-meta">{meta}</span>}
              {ep.more_info?.description && <span className="episode-desc">{ep.more_info.description}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
