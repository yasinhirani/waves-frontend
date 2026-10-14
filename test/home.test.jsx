import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const img = [{ quality: '150x150', url: 'https://x/a.jpg' }, { quality: '500x500', url: 'https://x/a.jpg' }];
const home = {
  new_trending: [{ id: 't1', title: 'Trending One', type: 'album', token: 'TR1', image: img }],
  top_playlists: [{ id: 'p1', title: 'Top Playlist One', type: 'playlist', token: 'PL1', image: img }],
  new_albums: [{ id: 'n1', title: 'New Album One', type: 'album', token: 'AL1', image: img }],
  charts: [{ id: 'c1', title: 'Chart One', type: 'playlist', token: 'CH1', image: img }],
  artist_recos: [
    { id: 'a1', title: 'Arijit Singh', type: 'artist', token: 'ART1', image: img },
    { id: 'a2', name: 'Shreya Ghoshal', perma_url: 'https://www.jiosaavn.com/artist/shreya/ART2', token: 'ART2', image: img } // no type
  ],
  city_mod: { data: [{ id: 'm1', title: 'Top in Pune', token: 'PUNE', image: img }] }, // wrapped + no type
  'promo:vx:data:107': [
    { id: 's1', title: 'Shri Krishna Amritvani', type: 'show', token: 'SHOW1', image: img },
    { id: 'x1', title: 'Promo That Is Not A Show', type: 'song', token: 'NOPE', image: img }
  ],
  radio: [{ id: 'r1', title: 'Chill Karo', type: 'radio_station', image: img, more_info: { language: 'hindi' } }],
  browse_discover: [{ id: 'b1', title: 'Also Hidden', image: img }]
};

vi.mock('../src/api/music', async (orig) => ({ ...(await orig()), fetchHome: vi.fn(async () => home) }));
import HomePage from '../src/pages/HomePage';

afterEach(cleanup);
const renderHome = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </QueryClientProvider>
  );

describe('HomePage', () => {
  it('shows exactly the eight configured sections, in order', async () => {
    renderHome();
    await screen.findByText('Trending One');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['New Trending', 'Top Playlists', 'New Albums', 'Charts', 'Podcasts', 'Radio Stations', 'Recommended Artists', 'Top in Your City']);
    expect(screen.queryByText('Should Not Appear')).toBeNull();
    expect(screen.queryByText('Also Hidden')).toBeNull();
  });

  it('podcasts come from promo:vx:data:107, only shows, and link to the podcast page', async () => {
    renderHome();
    await screen.findByText('Shri Krishna Amritvani');
    screen.getAllByRole('link', { name: 'Shri Krishna Amritvani' }).forEach((l) => expect(l.getAttribute('href')).toBe('/podcast/SHOW1'));
    expect(screen.queryByText('Promo That Is Not A Show')).toBeNull();
  });

  it('artist recommendations are round cards linking to the artist page (even without a type)', async () => {
    renderHome();
    await screen.findByText('Arijit Singh');
    for (const [name, href] of [['Arijit Singh', '/artist/ART1'], ['Shreya Ghoshal', '/artist/ART2']]) {
      const links = screen.getAllByRole('link', { name });
      expect(links.length).toBeGreaterThan(0);
      links.forEach((l) => expect(l.getAttribute('href')).toBe(href));
      expect(links[0].closest('.card').classList.contains('round')).toBe(true);
    }
  });

  it('city section accepts a wrapped list and links untyped items as playlists', async () => {
    renderHome();
    await screen.findByText('Top in Pune');
    screen.getAllByRole('link', { name: 'Top in Pune' }).forEach((l) => expect(l.getAttribute('href')).toBe('/playlist/PUNE'));
  });
});
