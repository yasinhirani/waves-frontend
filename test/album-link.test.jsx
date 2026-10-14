import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Player from '../src/components/Player';
import SongList from '../src/components/SongList';
import { usePlayerStore } from '../src/store/playerStore';
import { getAlbumToken } from '../src/utils/format';

const withAlbum = {
  id: '1', title: 'Chunnari Chunnari', subtitle: 'S', image: [{ quality: '150x150', url: 'https://x/1.jpg' }, { quality: '500x500', url: 'https://x/1.jpg' }],
  downloadUrl: [{ quality: '160kbps', url: 'https://x/1_160.mp4' }],
  more_info: { duration: '200', album_url: 'https://www.jiosaavn.com/album/biwi-no.-1/px52UxKqbiA_', artistMap: { primary_artists: [] } }
};
const noAlbum = { ...withAlbum, id: '2', title: 'Radio Song', more_info: { duration: '200', artistMap: { primary_artists: [] } } };

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
  window.scrollTo = vi.fn();
});
beforeEach(() => usePlayerStore.setState({ queue: [], index: -1, upNext: -1, isPlaying: false }));
afterEach(cleanup);

const AlbumStub = () => <div>Album Page</div>;
const setup = async (song, { mobile = false } = {}) => {
  window.matchMedia = (q) => ({ matches: mobile && q.includes('max-width: 900px'), media: q, addEventListener() {}, removeEventListener() {} });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<><SongList songs={[song]} /><Player /></>} />
          <Route path="/album/:token" element={<AlbumStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  await act(async () => { fireEvent.click(screen.getByText(song.title)); });
};

describe('getAlbumToken', () => {
  it('extracts the token from more_info.album_url', () => {
    expect(getAlbumToken(withAlbum)).toBe('px52UxKqbiA_');
    expect(getAlbumToken(noAlbum)).toBeUndefined();
    expect(getAlbumToken({})).toBeUndefined();
  });
});

describe('desktop player: go to album', () => {
  it('turns the track info into a link to the album when one exists', async () => {
    await setup(withAlbum);
    const link = screen.getByTitle('Go to album');
    expect(link.getAttribute('href')).toBe('/album/px52UxKqbiA_');
    fireEvent.click(link);
    expect(await screen.findByText('Album Page')).toBeTruthy();
  });

  it('is a plain, non-interactive block when there is no album (e.g. a radio song)', async () => {
    await setup(noAlbum);
    expect(screen.queryByTitle('Go to album')).toBeNull();
    expect(screen.getAllByText('Radio Song').every((el) => !el.closest('a'))).toBe(true);
  });
});

describe('mobile now-playing sheet: go to album', () => {
  it('shows a "Go to Album" link that navigates and closes the sheet', async () => {
    await setup(withAlbum, { mobile: true });
    await act(async () => { fireEvent.click(screen.getByLabelText('Open now playing')); });
    const link = screen.getByRole('link', { name: /Go to Album/i });
    expect(link.getAttribute('href')).toBe('/album/px52UxKqbiA_');
    fireEvent.click(link);
    expect(await screen.findByText('Album Page')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull(); // sheet closed itself on navigation
  });

  it('omits the link entirely when the track has no album', async () => {
    await setup(noAlbum, { mobile: true });
    await act(async () => { fireEvent.click(screen.getByLabelText('Open now playing')); });
    expect(screen.queryByRole('link', { name: /Go to Album/i })).toBeNull();
  });
});
