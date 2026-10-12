import { create } from 'zustand';
import { qualityFromConnection } from '../utils/adaptive';

/** Ephemeral, high-frequency playback info written by the audio engine and read by the UI. */
export const usePlaybackStore = create(() => ({
  time: 0,
  duration: 0,
  buffering: false,
  error: '',
  activeQuality: qualityFromConnection()
}));
