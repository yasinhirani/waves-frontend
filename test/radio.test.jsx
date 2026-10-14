import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlayerStore } from '../src/store/playerStore';

const img = [{ quality: '150x150', url: 'https://x/r.jpg' }, { quality: '500x500', url: 'https://x/r.jpg' }];
const station = {
  id: 'Madhur Kirtan', title: 'Madhur Kirtan', subtitle: 'Hindi Radio', type: 'radio_station', image: img,
  more_info: { language: 'hindi', station_display_text: 'Madhur Kirtan' }, token: 'Madhur-Kirtan'
};
const rsong = (id) => ({ id, title: `Radio Song ${id}`, type: 'song', image: img, downloadUrl: [{ quality: '160kbps', url: `https://x/${id}.mp4` }], more_info: { duration: '200', artistMap: { primary_artists: [] } } });

vi.mock('../src/api/music', async (orig) => ({
  ...(await orig()),
  startRadioStation: vi.fn(async () => ({ stationId: 'STID1', songs: [rsong('r1'), rsong('r2')] }))
}));
import * as music from '../src/api/music';
import HomePage from '../src/pages/HomePage';

beforeEach(() => usePlayerStore.setState({ queue: [], index: -1, upNext: -1, isPlaying: false, isRadio: false, radioStationId: null }));
afterEach(cleanup);

describe('radio stations on the homepage', () => {
  it('starts the station and plays immediately on click, with no detail page / navigation', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['home'], {
      new_trending: [], top_playlists: [], new_albums: [], charts: [],
      radio: [station]
    });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><HomePage /></MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByRole('heading', { name: 'Radio Stations' })).toBeTruthy();
    const card = screen.getByText('Madhur Kirtan').closest('button, a');
    expect(card.tagName).toBe('BUTTON'); // not a link - radio has no detail page

    fireEvent.click(card);
    await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(true));
    expect(music.startRadioStation).toHaveBeenCalledWith('Madhur Kirtan', 'hindi');
    const s = usePlayerStore.getState();
    expect(s.isRadio).toBe(true);
    expect(s.radioStationId).toBe('STID1');
    expect(s.queue.map((x) => x.id)).toEqual(['r1', 'r2']);
    expect(s.index).toBe(0);
  });
});
