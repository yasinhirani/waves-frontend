import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Player from '../src/components/Player';
import SongList from '../src/components/SongList';
import { usePlayerStore } from '../src/store/playerStore';

const song = {
  id: '1', title: 'One', subtitle: 'S',
  image: [{ quality: '150x150', url: 'https://x/1.jpg' }, { quality: '500x500', url: 'https://x/1.jpg' }],
  more_info: { duration: '200', artistMap: { primary_artists: [{ id: 'a', name: 'Artist', token: 't' }] } },
  downloadUrl: [{ quality: '160kbps', url: 'https://x/1_160.mp4' }]
};

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
  window.scrollTo = vi.fn();
  // pretend to be a phone
  window.matchMedia = (q) => ({ matches: q.includes('max-width: 900px'), media: q, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { cleanup(); usePlayerStore.setState({ queue: [], index: -1, upNext: -1, isPlaying: false }); });

const setup = async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><SongList songs={[song]} /><Player /></MemoryRouter>
    </QueryClientProvider>
  );
  await act(async () => { fireEvent.click(screen.getByText('One')); });
};

describe('mobile player', () => {
  it('shows a mini player instead of the desktop bar', async () => {
    await setup();
    expect(document.querySelector('.mini')).toBeTruthy();
    expect(document.querySelector('.player')).toBeNull();
    expect(document.querySelector('.sheet')).toBeNull();
  });

  it('opens a full-screen sheet with seek + all controls, and closes it again', async () => {
    await setup();
    await act(async () => { fireEvent.click(screen.getByLabelText('Open now playing')); });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    for (const label of ['Seek', 'Shuffle', 'Previous', 'Next', 'Pause', 'Repeat off']) {
      expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('160 kbps')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => { fireEvent.click(screen.getAllByLabelText('Pause').at(-1)); });
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    await act(async () => { fireEvent.click(screen.getByLabelText('Close now playing')); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the sheet with Escape', async () => {
    await setup();
    await act(async () => { fireEvent.click(screen.getByLabelText('Open now playing')); });
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
