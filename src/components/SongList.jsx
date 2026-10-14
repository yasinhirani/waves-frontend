import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { toast } from '../store/toastStore';
import { artistText, formatDuration, getImage, getPrimaryArtists, hasAudio } from '../utils/format';

function ArtistLinks({ song }) {
  const artists = getPrimaryArtists(song).filter((a) => a.name);
  if (!artists.length) return <>{artistText(song)}</>;
  return artists.map((a, i) => (
    <span key={`${a.id}-${i}`}>
      {i > 0 && ', '}
      {a.token ? (
        <Link to={`/artist/${a.token}`} onClick={(e) => e.stopPropagation()}>
          {a.name}
        </Link>
      ) : (
        a.name
      )}
    </span>
  ));
}

export const Equalizer = () => (
  <span className="eq" aria-label="Playing">
    <i />
    <i />
    <i />
  </span>
);

export default function SongList({ songs, showAlbum = false }) {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);

  const activate = (song, i) => {
    if (!hasAudio(song)) return toast.error('This track is not available');
    if (song.id === currentId) togglePlay();
    else playQueue(songs, i);
  };

  return (
    <ul className="song-list">
      {songs.map((song, i) => {
        const active = song.id === currentId;
        return (
          <li
            key={`${song.id}-${i}`}
            className={`song-row ${active ? 'active' : ''} ${hasAudio(song) ? '' : 'disabled'}`}
            role="button"
            tabIndex={0}
            onClick={() => activate(song, i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') activate(song, i);
            }}
          >
            <span className="song-index">
              {active && isPlaying ? <Equalizer /> : active ? <Play size={14} fill="currentColor" /> : i + 1}
            </span>
            <img className="song-thumb" src={getImage(song.image, '50x50')} alt="" loading="lazy" />
            <div className="song-meta">
              <span className="song-title">{song.title}</span>
              <span className="song-artists">
                <ArtistLinks song={song} />
              </span>
            </div>
            {showAlbum && <span className="song-album">{song.more_info?.album}</span>}
            <span className="song-duration">{formatDuration(song.more_info?.duration)}</span>
          </li>
        );
      })}
    </ul>
  );
}
