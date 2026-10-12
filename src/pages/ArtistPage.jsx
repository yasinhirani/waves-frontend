import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { queries } from '../api/queries';
import DetailHero from '../components/DetailHero';
import SongList from '../components/SongList';
import Section from '../components/Section';
import MediaCard from '../components/MediaCard';
import ErrorState from '../components/ErrorState';
import { ListSkeleton } from '../components/Skeletons';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePlayerStore } from '../store/playerStore';
import { formatCount, getToken, hasAudio, parseBio } from '../utils/format';

export default function ArtistPage() {
  const { token } = useParams();
  const { data, isPending, isError, error, refetch } = useQuery(queries.artist(token));
  const playQueue = usePlayerStore((s) => s.playQueue);
  const playShuffled = usePlayerStore((s) => s.playShuffled);
  const name = data?.name || data?.title;
  useDocumentTitle(name);

  if (isPending) return <ListSkeleton />;
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  const songs = data.topSongs ?? [];
  const albums = data.topAlbums ?? [];
  const similar = (data.similarArtists ?? []).map((a) => ({
    id: a.id,
    title: a.name,
    subtitle: 'Artist',
    image: a.image,
    type: 'artist',
    token: getToken(a)
  }));
  const followers = formatCount(data.follower_count);
  const bio = parseBio(data.bio);

  return (
    <>
      <DetailHero
        kind="Artist"
        round
        image={data.image}
        title={name}
        lines={[followers && `${followers} followers`, data.dominantLanguage]}
        disabled={!songs.some(hasAudio)}
        onPlay={() => playQueue(songs, 0)}
        onShuffle={() => playShuffled(songs)}
      />

      {songs.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Top Songs</h2>
          </div>
          <SongList songs={songs} showAlbum />
        </section>
      )}

      {albums.length > 0 && (
        <Section title="Top Albums">
          {albums.map((a, i) => (
            <MediaCard key={`${a.id}-${i}`} item={a} />
          ))}
        </Section>
      )}

      {similar.length > 0 && (
        <Section title="Similar Artists">
          {similar.map((a, i) => (
            <MediaCard key={`${a.id}-${i}`} item={a} />
          ))}
        </Section>
      )}

      {bio && (
        <section className="section">
          <div className="section-head">
            <h2>About</h2>
          </div>
          <p className="bio">{bio}</p>
        </section>
      )}
    </>
  );
}
