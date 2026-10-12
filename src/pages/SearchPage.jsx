import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SEARCH_PAGE_SIZE, searchApi } from '../api/music';
import SongList from '../components/SongList';
import CardGrid from '../components/CardGrid';
import ErrorState, { EmptyState } from '../components/ErrorState';
import { ListSkeleton } from '../components/Skeletons';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const TABS = [
  { key: 'songs', label: 'Songs' },
  { key: 'albums', label: 'Albums' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'artists', label: 'Artists' }
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() || '';
  const requested = params.get('type');
  const type = TABS.some((t) => t.key === requested) ? requested : 'songs';
  useDocumentTitle(q ? `Search: ${q}` : 'Search');

  const query = useInfiniteQuery({
    queryKey: ['search', type, q],
    enabled: Boolean(q),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => searchApi(type, q, pageParam, signal),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.results.length, 0);
      const total = Number(last.total);
      const more = Number.isFinite(total) ? loaded < total : last.results.length >= SEARCH_PAGE_SIZE;
      return last.results.length && more ? all.length + 1 : undefined;
    },
    staleTime: 2 * 60 * 1000
  });

  const results = query.data?.pages.flatMap((p) => p.results) ?? [];

  const body = () => {
    if (!q) return <EmptyState message="Search for songs, albums, playlists and artists." />;
    if (query.isPending) return <ListSkeleton />;
    if (query.isError) return <ErrorState message={query.error.message} onRetry={query.refetch} />;
    if (!results.length) return <EmptyState message={`No ${type} found for “${q}”.`} />;
    return type === 'songs' ? <SongList songs={results} showAlbum /> : <CardGrid items={results} />;
  };

  return (
    <div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === type}
            className={`tab ${t.key === type ? 'active' : ''}`}
            onClick={() => setParams({ q, type: t.key }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {body()}

      {query.hasNextPage && (
        <div className="center">
          <button className="btn" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
