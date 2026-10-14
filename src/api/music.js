import { api } from './client';

const unwrap = (res) => res.data.data;

export const fetchHome = (signal) => api.get('/home', { signal }).then(unwrap);
export const fetchSong = (token, signal) => api.get(`/songs/${token}`, { signal }).then(unwrap);
export const fetchAlbum = (token, signal) => api.get(`/albums/${token}`, { signal }).then(unwrap);
export const fetchArtist = (token, signal) => api.get(`/artists/${token}`, { signal }).then(unwrap);
export const fetchPlaylist = (token, page = 1, signal) =>
  api.get(`/playlists/${token}`, { params: { page, limit: 50 }, signal }).then(unwrap);

export const fetchPodcast = (token, season = 1, signal) =>
  api.get(`/podcasts/${token}`, { params: { season }, signal }).then(unwrap);

/** More episodes (page 1 is part of the show details). showId is the numeric show_details.id */
export const fetchPodcastEpisodes = (showId, season = 1, page = 2, signal) =>
  api.get(`/podcasts/${showId}/episodes`, { params: { season, page, sortOrder: 'desc' }, signal }).then(unwrap);

/** One call: creates a featured radio station and returns { stationId, songs } (first batch). */
export const startRadioStation = (name, language, signal) =>
  api.get('/radio/station', { params: { name, language }, signal }).then(unwrap);

/** Called again once the queued songs for a station run low. */
export const fetchMoreRadioSongs = (stationId, signal) =>
  api.get(`/radio/${stationId}/songs`, { signal }).then((res) => unwrap(res).songs ?? []);

export const SEARCH_PAGE_SIZE = 20;
export const searchApi = (type, q, page, signal) =>
  api
    .get(`/search/${type}`, { params: { q, page, limit: SEARCH_PAGE_SIZE }, signal })
    .then((res) => {
      const d = unwrap(res);
      return { results: Array.isArray(d) ? d : (d?.results ?? []), total: d?.total };
    });
