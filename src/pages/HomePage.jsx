import { useQuery } from '@tanstack/react-query';
import { queries } from '../api/queries';
import Section from '../components/Section';
import MediaCard from '../components/MediaCard';
import ErrorState from '../components/ErrorState';
import { CardRowSkeleton } from '../components/Skeletons';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

/** Accepts [..] or { data: [..] } / { list: [..] } */
const toList = (value) =>
  (Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.list) ? value.list : []).filter(Boolean);

// Podcasts live in a promo slot of the launch data: "promo:vx:data:107" (items of type "show")
const PODCAST_KEY = 'promo:vx:data:107';
const pickPodcasts = (data) => {
  const primary = toList(data?.[PODCAST_KEY]);
  if (primary.length) return primary;
  // the promo slot number can change – fall back to any promo list that contains shows
  for (const [key, value] of Object.entries(data ?? {})) {
    if (!key.startsWith('promo:vx:data:')) continue;
    const list = toList(value);
    if (list.some((i) => i.type === 'show')) return list;
  }
  return [];
};

// Only these sections of the launch data are shown on the homepage.
// `defaultType` is used when an item has no `type`; `types` (optional) restricts what is shown.
const SECTIONS = [
  { id: 'new_trending', title: 'New Trending', pick: (d) => d.new_trending },
  { id: 'top_playlists', title: 'Top Playlists', pick: (d) => d.top_playlists },
  { id: 'new_albums', title: 'New Albums', pick: (d) => d.new_albums },
  { id: 'charts', title: 'Charts', pick: (d) => d.charts },
  { id: 'podcasts', title: 'Podcasts', pick: pickPodcasts, defaultType: 'show', types: ['show'] },
  { id: 'radio', title: 'Radio Stations', pick: (d) => d.radio, defaultType: 'radio_station', types: ['radio_station'] },
  { id: 'artist_recos', title: 'Recommended Artists', pick: (d) => d.artist_recos, defaultType: 'artist' },
  { id: 'city_mod', title: 'Top in Your City', pick: (d) => d.city_mod, defaultType: 'playlist' }
];

const buildItems = (data, { pick, defaultType, types }) => {
  const items = toList(pick(data ?? {})).map((item) => (item.type || !defaultType ? item : { ...item, type: defaultType }));
  return types ? items.filter((i) => types.includes(i.type)) : items;
};

export default function HomePage() {
  useDocumentTitle('');
  const { data, isPending, isError, error, refetch } = useQuery(queries.home());

  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      {SECTIONS.map((section) => {
        if (isPending)
          return (
            <section className="section" key={section.id}>
              <div className="section-head">
                <h2>{section.title}</h2>
              </div>
              <CardRowSkeleton />
            </section>
          );

        const items = buildItems(data, section);
        if (!items.length) return null; // section missing for this user/region -> just hide it
        return (
          <Section key={section.id} title={section.title}>
            {items.map((item, i) => (
              <MediaCard key={`${item.id}-${i}`} item={item} />
            ))}
          </Section>
        );
      })}
    </>
  );
}
