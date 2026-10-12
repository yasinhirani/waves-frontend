import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { queries } from '../api/queries';
import DetailHero from '../components/DetailHero';
import SongList from '../components/SongList';
import ErrorState from '../components/ErrorState';
import { ListSkeleton } from '../components/Skeletons';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePlayerStore } from '../store/playerStore';
import { hasAudio } from '../utils/format';

export default function AlbumPage() {
  const { token } = useParams();
  const { data, isPending, isError, error, refetch } = useQuery(queries.album(token));
  const playQueue = usePlayerStore((s) => s.playQueue);
  const playShuffled = usePlayerStore((s) => s.playShuffled);
  useDocumentTitle(data?.title);

  if (isPending) return <ListSkeleton />;
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  const songs = data.list ?? [];
  const meta = [data.year, songs.length ? `${songs.length} songs` : ''].filter(Boolean).join(' · ');

  return (
    <>
      <DetailHero
        kind="Album"
        image={data.image}
        title={data.title}
        lines={[data.subtitle, meta]}
        disabled={!songs.some(hasAudio)}
        onPlay={() => playQueue(songs, 0)}
        onShuffle={() => playShuffled(songs)}
      />
      <SongList songs={songs} />
    </>
  );
}
