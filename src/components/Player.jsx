import { useEffect, useState } from 'react';
import {
  ChevronDown, Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { usePlaybackStore } from '../store/playbackStore';
import { previous, seekTo } from '../player/engine';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { bitrateOf } from '../utils/adaptive';
import { artistText, formatDuration, getImage } from '../utils/format';

/**
 * Pure UI. All audio logic (loading, next-track, pre-loading, media session…) lives in
 * src/player/engine.js so playback keeps working while the page is in the background.
 */
export default function Player() {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const { togglePlay, next, setVolume, toggleMute, toggleShuffle, cycleRepeat } = usePlayerStore.getState();

  const currentTime = usePlaybackStore((s) => s.time);
  const mediaDuration = usePlaybackStore((s) => s.duration);
  const buffering = usePlaybackStore((s) => s.buffering);
  const error = usePlaybackStore((s) => s.error);
  const activeQuality = usePlaybackStore((s) => s.activeQuality);

  const song = queue[index];
  const duration = mediaDuration || Number(song?.more_info?.duration) || 0;

  // Phones / small tablets get a mini player + full-screen "Now Playing" sheet
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isMobile || !song) setExpanded(false);
  }, [isMobile, song]);

  useEffect(() => {
    if (!expanded) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  // Space bar toggles playback (unless typing / focused on a control)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) || e.target.isContentEditable) return;
      if (usePlayerStore.getState().index < 0) return;
      e.preventDefault();
      usePlayerStore.getState().togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const effectiveVolume = muted ? 0 : volume;
  const subtitle = error || (song ? artistText(song) : '');
  const qualityLabel = `${bitrateOf(activeQuality)} kbps`;

  // ---------- shared pieces ----------
  const playButton = (size) => (
    <button className="play-btn" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
      {buffering && isPlaying ? (
        <Loader2 size={size} className="spin" />
      ) : isPlaying ? (
        <Pause size={size} fill="currentColor" />
      ) : (
        <Play size={size} fill="currentColor" />
      )}
    </button>
  );

  const seekBar = (
    <div className="player-seek">
      <span>{formatDuration(currentTime)}</span>
      <input
        type="range"
        className="range"
        aria-label="Seek"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => seekTo(Number(e.target.value))}
        style={{ '--pct': `${pct}%` }}
      />
      <span>{formatDuration(duration)}</span>
    </div>
  );

  const transport = (
    <div className="player-controls">
      <button className={`icon-btn ${shuffle ? 'on' : ''}`} aria-label="Shuffle" aria-pressed={shuffle} onClick={toggleShuffle}>
        <Shuffle size={18} />
      </button>
      <button className="icon-btn" aria-label="Previous" onClick={previous}>
        <SkipBack size={20} fill="currentColor" />
      </button>
      {playButton(22)}
      <button className="icon-btn" aria-label="Next" onClick={() => next()}>
        <SkipForward size={20} fill="currentColor" />
      </button>
      <button className={`icon-btn ${repeat !== 'off' ? 'on' : ''}`} aria-label={`Repeat ${repeat}`} onClick={cycleRepeat}>
        <RepeatIcon size={18} />
      </button>
    </div>
  );

  if (!song) return null;

  // ---------- desktop / large tablet ----------
  if (!isMobile) {
    return (
      <div className="player" role="region" aria-label="Music player">
        <div className="player-track">
          <img src={getImage(song.image, '150x150')} alt="" />
          <div className="player-meta">
            <span className="player-title">{song.title}</span>
            <span className="player-artist">{subtitle}</span>
          </div>
        </div>

        <div className="player-center">
          {transport}
          {seekBar}
        </div>

        <div className="player-extra">
          <span className="player-quality" title="Audio quality adjusts automatically to your connection">
            {qualityLabel}
          </span>
          <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
            {effectiveVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            className="range volume"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.01}
            value={effectiveVolume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ '--pct': `${effectiveVolume * 100}%` }}
          />
        </div>
      </div>
    );
  }

  // ---------- phones: mini player + full-screen sheet ----------
  return (
    <>
      <div className="mini" role="region" aria-label="Music player">
        <div className="mini-progress" style={{ '--pct': `${pct}%` }} />
        <button className="mini-track" aria-label="Open now playing" onClick={() => setExpanded(true)}>
          <img src={getImage(song.image, '150x150')} alt="" />
          <span className="player-meta">
            <span className="player-title">{song.title}</span>
            <span className="player-artist">{subtitle}</span>
          </span>
        </button>
        <div className="mini-actions">
          {playButton(20)}
          <button className="icon-btn" aria-label="Next" onClick={() => next()}>
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
          style={{ '--art': `url("${getImage(song.image, '500x500')}")` }}
        >
          <div className="sheet-top">
            <button className="icon-btn" aria-label="Close now playing" onClick={() => setExpanded(false)}>
              <ChevronDown size={26} />
            </button>
            <span>Now Playing</span>
            <span className="player-quality">{qualityLabel}</span>
          </div>
          <img className="sheet-art" src={getImage(song.image, '500x500')} alt={song.title} />
          <div className="sheet-meta">
            <h2>{song.title}</h2>
            <p>{subtitle}</p>
          </div>
          {seekBar}
          {transport}
        </div>
      )}
    </>
  );
}
