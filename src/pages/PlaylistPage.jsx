import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchPlaylist } from '../api/music';
import DetailHero from '../components/DetailHero';
import SongList from '../components/SongList';
import ErrorState from '../components/ErrorState';
import { ListSkeleton } from '../components/Skeletons';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePlayerStore } from '../store/playerStore';
import { formatCount, hasAudio } from '../utils/format';

export default function PlaylistPage() {
  const { token } = useParams();
  const query = useInfiniteQuery({
    queryKey: ['playlist', token],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchPlaylist(token, pageParam, signal),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + (p.list?.length ?? 0), 0);
      return last.list?.length && loaded < Number(last.list_count) ? all.length + 1 : undefined;
    },
    staleTime: 10 * 60 * 1000
  });
  const playQueue = usePlayerStore((s) => s.playQueue);
  const playShuffled = usePlayerStore((s) => s.playShuffled);

  const first = query.data?.pages[0];
  useDocumentTitle(first?.title);

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={query.refetch} />;

  const songs = query.data.pages.flatMap((p) => p.list ?? []);
  const followers = formatCount(first.more_info?.follower_count);
  const meta = [first.list_count ? `${first.list_count} songs` : '', followers && `${followers} followers`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <DetailHero
        kind="Playlist"
        image={first.image}
        title={first.title}
        lines={[first.header_desc || first.subtitle, meta]}
        disabled={!songs.some(hasAudio)}
        onPlay={() => playQueue(songs, 0)}
        onShuffle={() => playShuffled(songs)}
      />
      <SongList songs={songs} showAlbum />
      {query.hasNextPage && (
        <div className="center">
          <button className="btn" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
