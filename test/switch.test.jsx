import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Player from '../src/components/Player';
import SongList from '../src/components/SongList';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { getAudio } from '../src/player/engine';

const mk = (id, title) => ({
  id, title, subtitle: 'Sub', image: [{ quality: '150x150', url: `https://x/${id}-150.jpg` }, { quality: '500x500', url: `https://x/${id}-500.jpg` }],
  more_info: { duration: '200', album: 'Alb', artistMap: { primary_artists: [{ id: 'a' + id, name: 'Artist ' + id, token: 'tok' + id }] } },
  downloadUrl: [{ quality: '160kbps', url: `https://x/${id}_160.mp4` }, { quality: '320kbps', url: `https://x/${id}_320.mp4` }]
});
const songs = [mk('1', 'One'), mk('2', 'Two'), mk('3', 'Three')];

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
  window.scrollTo = vi.fn();
  globalThis.MediaMetadata = class { constructor(i) { i.artwork.forEach((a) => new URL(a.src)); Object.assign(this, i); } };
  Object.defineProperty(navigator, 'mediaSession', { value: { setActionHandler() {}, metadata: null, playbackState: 'none' }, configurable: true });
});

describe('switching songs', () => {
  it('does not crash when a second song is picked while one plays', async () => {
    const errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' ')));
    const qc = new QueryClient();
    render(
      <ErrorBoundary>
        <QueryClientProvider client={qc}><MemoryRouter><SongList songs={songs} /><Player /></MemoryRouter></QueryClientProvider>
      </ErrorBoundary>
    );
    await act(async () => { fireEvent.click(screen.getByText('One')); });
    expect(getAudio().src).toContain('1_160');
    await act(async () => { fireEvent.click(screen.getByText('Two')); });
    const audio = getAudio();
    await act(async () => {
      // several media events landing in one batch, like a real browser
      fireEvent.timeUpdate(audio);
      fireEvent.loadedMetadata(audio);
      fireEvent.canPlay(audio);
    });
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(getAudio().src).toContain('2_160');
    console.log('ERRORS:', JSON.stringify(errors.slice(0, 3)).slice(0, 800));
  });
});
