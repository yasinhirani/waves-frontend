import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { usePlayItem } from '../hooks/usePlayItem';
import { getImage, getImageSrcSet, routeFor } from '../utils/format';

const PLAYABLE = ['song', 'album', 'playlist', 'show', 'radio_station'];

function ContentLink({ item, play, className, children }) {
  const route = routeFor(item);
  if (route) return <Link to={route} className={className}>{children}</Link>;
  if (item.type === 'song' || item.type === 'radio_station')
    return (
      <button type="button" className={className} onClick={() => play(item)}>
        {children}
      </button>
    );
  return <span className={className}>{children}</span>;
}

export default function MediaCard({ item }) {
  const play = usePlayItem();
  const round = item.type === 'artist' || item?.more_info?.featured_station_type === 'artist';
  const title = item.title || item.name;

  return (
    <article className={`card ${round ? 'round' : ''}`}>
      <div className="card-cover">
        <ContentLink item={item} play={play} className="card-cover-link">
          <img
            src={getImage(item.image, '150x150')}
            srcSet={getImageSrcSet(item.image)}
            sizes="(max-width: 640px) 140px, 180px"
            alt={title}
            loading="lazy"
            decoding="async"
          />
        </ContentLink>
        {PLAYABLE.includes(item.type) && (
          <button className="card-play" aria-label={`Play ${title}`} onClick={() => play(item)}>
            <Play size={20} fill="currentColor" />
          </button>
        )}
      </div>
      <ContentLink item={item} play={play} className="card-title">
        {title}
      </ContentLink>
      {item.subtitle && <p className="card-sub">{item.subtitle}</p>}
    </article>
  );
}
