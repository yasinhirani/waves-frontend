import { Loader2 } from 'lucide-react';

export const PageLoader = () => (
  <div className="page-loader" role="status" aria-label="Loading">
    <Loader2 className="spin" size={28} />
  </div>
);

export const CardRowSkeleton = ({ count = 8 }) => (
  <div className="row" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div className="card" key={i}>
        <div className="skeleton card-cover" />
        <div className="skeleton line" />
        <div className="skeleton line short" />
      </div>
    ))}
  </div>
);

export const ListSkeleton = ({ count = 8 }) => (
  <ul className="song-list" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <li className="song-row" key={i}>
        <span className="song-index" />
        <div className="skeleton song-thumb" />
        <div className="song-meta">
          <div className="skeleton line" />
          <div className="skeleton line short" />
        </div>
      </li>
    ))}
  </ul>
);
