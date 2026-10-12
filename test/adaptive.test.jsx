import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Player from '../src/components/Player';
import SongList from '../src/components/SongList';
import { usePlayerStore } from '../src/store/playerStore';
import { getAudio } from '../src/player/engine';
import { qualityFromConnection, qualityFromKbps, stepDown, stepUp } from '../src/utils/adaptive';

describe('adaptive helpers', () => {
  it('maps connection info to a starting quality', () => {
    expect(qualityFromConnection(undefined)).toBe('160kbps');
    expect(qualityFromConnection({ saveData: true })).toBe('48kbps');
    expect(qualityFromConnection({ effectiveType: '2g' })).toBe('48kbps');
    expect(qualityFromConnection({ effectiveType: '3g' })).toBe('96kbps');
    expect(qualityFromConnection({ effectiveType: '4g', downlink: 10 })).toBe('320kbps');
    expect(qualityFromConnection({ effectiveType: '4g', downlink: 0.5 })).toBe('96kbps');
    expect(qualityFromConnection({ effectiveType: '4g' })).toBe('160kbps');
  });
  it('maps measured speed and steps along the ladder', () => {
    expect(qualityFromKbps(2000, 2.5)).toBe('320kbps');
    expect(qualityFromKbps(300, 2.5)).toBe('96kbps');
    expect(qualityFromKbps(10, 2.5)).toBe('48kbps');
    expect(stepDown('160kbps')).toBe('96kbps');
    expect(stepDown('48kbps')).toBe('48kbps');
    expect(stepUp('160kbps')).toBe('320kbps');
    expect(stepUp('320kbps')).toBe('320kbps');
  });
});

const mk = (id, title) => ({
  id, title, subtitle: 'S',
  image: [{ quality: '150x150', url: `https://x/${id}.jpg` }, { quality: '500x500', url: `https://x/${id}.jpg` }],
  more_info: { duration: '200', artistMap: { primary_artists: [{ id: 'a' + id, name: 'A' + id, token: 't' + id }] } },
  downloadUrl: ['48', '96', '160', '320'].map((b) => ({ quality: `${b}kbps`, url: `https://x/${id}_${b}.mp4` }))
});
const songs = [mk('1', 'One'), mk('2', 'Two')];

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
  window.scrollTo = vi.fn();
});

let audio;
const setup = async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><SongList songs={songs} /><Player /></MemoryRouter>
    </QueryClientProvider>
  );
  await act(async () => { fireEvent.click(screen.getByText('One')); });
  audio = getAudio();
  Object.defineProperty(audio, 'currentTime', { value: 5, writable: true, configurable: true });
};
const fire = (name) => act(async () => { audio.dispatchEvent(new Event(name)); });

beforeEach(() => usePlayerStore.setState({ queue: [], index: -1, upNext: -1, isPlaying: false, quality: '160kbps' }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('automatic bitrate in the player', () => {
  it('has no quality dropdown and shows the active bitrate', async () => {
    await setup();
    expect(document.querySelector('select')).toBeNull();
    expect(screen.getByText('160 kbps')).toBeTruthy();
    expect(getAudio().src).toContain('1_160');
  });

  it('drops quality mid-track after repeated stalls, and keeps it for the next track', async () => {
    await setup();
    await fire('waiting');
    expect(audio.src).toContain('1_160'); // one stall is tolerated
    await fire('waiting');
    expect(getAudio().src).toContain('1_96');
    expect(screen.getByText('96 kbps')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('Two')); });
    expect(getAudio().src).toContain('2_96');
  });

  it('raises quality for the NEXT track when measured speed is high (never mid-track)', async () => {
    await setup();
    let bufEnd = 5;
    Object.defineProperty(audio, 'buffered', {
      configurable: true,
      get: () => ({ length: 1, start: () => 0, end: () => bufEnd })
    });
    const now = vi.spyOn(performance, 'now');
    // simulated clock starts far in the future: the engine (like the real app) keeps its 60 s hold after a quality drop
    for (const [t, end] of [[1e6, 5], [1e6 + 1000, 15], [1e6 + 2000, 25], [1e6 + 3000, 35]]) {
      now.mockReturnValue(t);
      bufEnd = end;
      await fire('progress');
    }
    expect(usePlayerStore.getState().quality).toBe('320kbps');
    expect(audio.src).toContain('1_160'); // current track untouched
    await act(async () => { fireEvent.click(screen.getByText('Two')); });
    expect(getAudio().src).toContain('2_320');
  });

  it('ignores stalls caused by seeking or start-up', async () => {
    await setup();
    Object.defineProperty(audio, 'seeking', { value: true, configurable: true });
    await fire('waiting'); await fire('waiting'); await fire('waiting');
    expect(audio.src).toContain('1_160');
  });
});
