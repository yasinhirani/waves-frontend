import { Play, Shuffle } from 'lucide-react';
import { getImage } from '../utils/format';

export default function DetailHero({ image, kind, title, lines = [], round = false, onPlay, onShuffle, disabled, hideShuffle = false }) {
  return (
    <div className="hero">
      <img className={`hero-img ${round ? 'round' : ''}`} src={getImage(image, '500x500')} alt={title} />
      <div className="hero-info">
        <span className="hero-kind">{kind}</span>
        <h1>{title}</h1>
        {lines.filter(Boolean).map((l, i) => (
          <p key={i} className="hero-line">
            {l}
          </p>
        ))}
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={onPlay} disabled={disabled}>
            <Play size={18} fill="currentColor" /> Play
          </button>
          {!hideShuffle && (
            <button className="btn" onClick={onShuffle} disabled={disabled}>
              <Shuffle size={18} /> Shuffle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
