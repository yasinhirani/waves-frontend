import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlayerStore } from '../src/store/playerStore';

const img = [{ quality: '150x150', url: 'https://x/e.jpg' }, { quality: '500x500', url: 'https://x/e.jpg' }];
const mp3 = (id) => ['12', '48', '96', '160', '320'].map((b) => ({ quality: `${b}kbps`, url: `https://hub/${id}.mp3` })); // same URL x5
const episode = (id, title, seq) => ({
  id, title, type: 'episode', image: img, play_count: '11860998', downloadUrl: mp3(id),
  more_info: { duration: '336', release_date: '2021-07-29', description: `About ${title}`, show_title: 'Shri Krishna Amritvani', artistMap: { primary_artists: [] }, sequence_number: String(seq) }
});
const show = (season) => ({
  show_details: {
    id: '63565', title: 'Shri Krishna Amritvani', header_desc: 'Gita updesh for everyday life', language: 'hindi', image: img,
    more_info: { label: 'Podcaster', total_episodes: '12', followers_count: '876015', square_image: 'https://x/sq.jpg' }
  },
  seasons: [
    { id: 's1', title: 'Season 1', more_info: { season_number: '1', numEpisodes: '3' } }, // 2 on page 1, 1 more to load
    { id: 's2', title: 'Season 2', more_info: { season_number: '2', numEpisodes: '2' } } // everything already loaded
  ],
  episodes: [episode(`e${season}a`, `Season ${season} Episode One`, 1), episode(`e${season}b`, `Season ${season} Episode Two`, 2)]
});

vi.mock('../src/api/music', async (orig) => ({ ...(await orig()), fetchPodcast: vi.fn(async (_t, season) => show(season)),
  fetchPodcastEpisodes: vi.fn(async () => ({ page: 2, episodes: [episode('e1c', 'Season 1 Episode Three', 3), episode('e1a', 'Season 1 Episode One', 1)] })) // 2nd one is a duplicate
}));
import * as music from '../src/api/music';
import PodcastPage from '../src/pages/PodcastPage';
import { artistText, formatEpisodeDuration, hasSingleSource, routeFor } from '../src/utils/format';

const renderPage = (path = '/podcast/SHOW1') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/podcast/:token" element={<PodcastPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => usePlayerStore.setState({ queue: [], index: -1, upNext: -1, isPlaying: false }));
afterEach(cleanup);

describe('PodcastPage', () => {
  it('shows the show, its episodes (with duration/plays) and the About text', async () => {
    renderPage();
    await screen.findByText('Season 1 Episode One');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Shri Krishna Amritvani');
    expect(screen.getAllByText(/6 min/).length).toBe(2); // 336 s, two episodes
    expect(screen.getAllByText(/12M plays/).length).toBe(2);
    expect(screen.getByText('Gita updesh for everyday life')).toBeTruthy();
    expect(screen.queryByText('Shuffle')).toBeNull(); // no shuffle for podcasts
  });

  it('plays the tapped episode with the whole list as the queue', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Season 1 Episode Two'));
    const s = usePlayerStore.getState();
    expect(s.queue.map((e) => e.title)).toEqual(['Season 1 Episode One', 'Season 1 Episode Two']);
    expect(s.index).toBe(1);
    expect(s.isPlaying).toBe(true);
  });

  it('loads more episodes with the numeric show id, merges them and ignores duplicates', async () => {
    renderPage();
    await screen.findByText('Season 1 Episode One');
    expect(screen.queryByText('Season 1 Episode Three')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Load more episodes' }));
    await screen.findByText('Season 1 Episode Three');
    expect(music.fetchPodcastEpisodes).toHaveBeenCalledWith('63565', 1, 2, expect.anything());
    expect(screen.getAllByText('Season 1 Episode One').length).toBe(1); // duplicate dropped
    expect(screen.getAllByText(/^Season 1 Episode/).length).toBe(3);
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()); // 3 of 3 loaded
  });

  it('plays from the full loaded list after loading more', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Load more episodes' }));
    fireEvent.click(await screen.findByText('Season 1 Episode Three'));
    expect(usePlayerStore.getState().queue).toHaveLength(3);
    expect(usePlayerStore.getState().index).toBe(2);
  });

  it('has no "load more" when the season is already fully loaded', async () => {
    renderPage('/podcast/SHOW1?season=2');
    await screen.findByText('Season 2 Episode One');
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('switches seasons through the tabs and refetches', async () => {
    renderPage();
    await screen.findByText('Season 1 Episode One');
    fireEvent.click(screen.getByRole('tab', { name: 'Season 2' }));
    await screen.findByText('Season 2 Episode One');
    expect(music.fetchPodcast).toHaveBeenLastCalledWith('SHOW1', 2, expect.anything());
  });
});

describe('podcast helpers', () => {
  it('routes shows to /podcast/:token and labels episodes with the show title', () => {
    expect(routeFor({ type: 'show', token: 'abc' })).toBe('/podcast/abc');
    expect(artistText(episode('e', 'T', 1))).toBe('Shri Krishna Amritvani');
    expect(formatEpisodeDuration(3900)).toBe('1 hr 5 min');
    expect(formatEpisodeDuration(45)).toBe('1 min');
  });
  it('detects single-source (MP3) tracks vs. real bitrate ladders', () => {
    expect(hasSingleSource(episode('e', 'T', 1))).toBe(true);
    expect(hasSingleSource({ downloadUrl: [{ quality: '160kbps', url: 'a' }, { quality: '320kbps', url: 'b' }] })).toBe(false);
    expect(hasSingleSource({})).toBe(false);
  });
});
