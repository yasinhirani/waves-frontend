import { useQuery } from '@tanstack/react-query';
import { queries } from '../api/queries';
import Section from '../components/Section';
import MediaCard from '../components/MediaCard';
import ErrorState from '../components/ErrorState';
import { CardRowSkeleton } from '../components/Skeletons';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Only these sections of the launch data are shown on the homepage.
// `defaultType` is used when JioSaavn omits `type` on an item, so the card still links correctly.
const SECTIONS = [
  { key: 'new_trending', title: 'New Trending' },
  { key: 'top_playlists', title: 'Top Playlists' },
  { key: 'new_albums', title: 'New Albums' },
  { key: 'charts', title: 'Charts' },
  { key: 'artist_recos', title: 'Recommended Artists', defaultType: 'artist' },
  { key: 'city_mod', title: 'Top in Your City', defaultType: 'playlist' }
];

/** Accepts [..] or { data: [..] } / { list: [..] } and fills in a missing item type. */
const toItems = (value, defaultType) => {
  const list = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.list) ? value.list : [];
  return list.filter(Boolean).map((item) => (item.type || !defaultType ? item : { ...item, type: defaultType }));
};

export default function HomePage() {
  useDocumentTitle('');
  const { data, isPending, isError, error, refetch } = useQuery(queries.home());

  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      {SECTIONS.map(({ key, title, defaultType }) => {
        if (isPending)
          return (
            <section className="section" key={key}>
              <div className="section-head">
                <h2>{title}</h2>
              </div>
              <CardRowSkeleton />
            </section>
          );

        const items = toItems(data?.[key], defaultType);
        if (!items.length) return null; // section missing for this user/region -> just hide it
        return (
          <Section key={key} title={title}>
            {items.map((item, i) => (
              <MediaCard key={`${item.id}-${i}`} item={item} />
            ))}
          </Section>
        );
      })}
    </>
  );
}
