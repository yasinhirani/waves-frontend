import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchPodcast, fetchPodcastEpisodes } from '../api/music';
import DetailHero from '../components/DetailHero';
import EpisodeList from '../components/EpisodeList';
import ErrorState, { EmptyState } from '../components/ErrorState';
import { ListSkeleton } from '../components/Skeletons';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePlayerStore } from '../store/playerStore';
import { formatCount, hasAudio } from '../utils/format';

const uniqueEpisodes = (pages) => {
  const seen = new Set();
  return pages.flatMap((p) => p.episodes ?? []).filter((ep) => !seen.has(ep.id) && seen.add(ep.id));
};

export default function PodcastPage() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const season = Math.max(1, Number(params.get('season')) || 1);

  const query = useInfiniteQuery({
    queryKey: ['podcast-pages', token, season],
    initialPageParam: { page: 1 },
    // page 1 = show details (+ first episodes); page 2+ = "all episodes" endpoint
    queryFn: ({ pageParam, signal }) =>
      pageParam.page === 1
        ? fetchPodcast(token, season, signal)
        : fetchPodcastEpisodes(pageParam.showId, season, pageParam.page, signal),
    getNextPageParam: (last, all) => {
      const showId = all[0].show_details?.id;
      if (!showId || !last.episodes?.length) return undefined;
      const count = uniqueEpisodes(all).length;
      if (all.length > 1 && count === uniqueEpisodes(all.slice(0, -1)).length) return undefined; // nothing new -> stop
      const seasonInfo = all[0].seasons?.find((s) => Number(s.more_info?.season_number) === season);
      const total = Number(seasonInfo?.more_info?.numEpisodes ?? all[0].show_details?.more_info?.total_episodes);
      if (Number.isFinite(total) && count >= total) return undefined;
      return { page: all.length + 1, showId };
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData // no flash while switching seasons
  });
  const { data, isPending, isError, error, refetch, isPlaceholderData } = query;
  const playQueue = usePlayerStore((s) => s.playQueue);
  const first = data?.pages[0];
  const show = first?.show_details;
  useDocumentTitle(show?.title);

  if (isPending) return <ListSkeleton />;
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  const info = show?.more_info ?? {};
  const episodes = uniqueEpisodes(data.pages);
  const seasons = Array.isArray(first.seasons) ? first.seasons : [];
  const followers = formatCount(info.followers_count);
  const meta = [show?.language, info.total_episodes && `${info.total_episodes} episodes`, followers && `${followers} followers`]
    .filter(Boolean)
    .join(' · ');
  const about = show?.header_desc || info.description;

  return (
    <>
      <DetailHero
        kind="Podcast"
        image={info.square_image || show?.image}
        title={show?.title}
        lines={[info.label, meta]}
        hideShuffle
        disabled={!episodes.some(hasAudio)}
        onPlay={() => playQueue(episodes, 0)}
      />

      {seasons.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Seasons">
          {seasons.map((s) => {
            const n = Number(s.more_info?.season_number) || 1;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={n === season}
                className={`tab ${n === season ? 'active' : ''}`}
                onClick={() => setParams({ season: String(n) }, { replace: true })}
              >
                {s.title || `Season ${n}`}
              </button>
            );
          })}
        </div>
      )}

      <section className="section" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
        <div className="section-head">
          <h2>Episodes</h2>
        </div>
        {episodes.length ? <EpisodeList episodes={episodes} /> : <EmptyState message="No episodes yet." />}
        {query.hasNextPage && (
          <div className="center">
            <button className="btn" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {query.isFetchingNextPage ? 'Loading…' : 'Load more episodes'}
            </button>
          </div>
        )}
        {query.isFetchNextPageError && <ErrorState message={query.error.message} onRetry={() => query.fetchNextPage()} />}
      </section>

      {about && (
        <section className="section">
          <div className="section-head">
            <h2>About</h2>
          </div>
          <p className="bio">{about}</p>
        </section>
      )}
    </>
  );
}
