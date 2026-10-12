import { api } from './client';

const unwrap = (res) => res.data.data;

export const fetchHome = (signal) => api.get('/home', { signal }).then(unwrap);
export const fetchSong = (token, signal) => api.get(`/songs/${token}`, { signal }).then(unwrap);
export const fetchAlbum = (token, signal) => api.get(`/albums/${token}`, { signal }).then(unwrap);
export const fetchArtist = (token, signal) => api.get(`/artists/${token}`, { signal }).then(unwrap);
export const fetchPlaylist = (token, page = 1, signal) =>
  api.get(`/playlists/${token}`, { params: { page, limit: 50 }, signal }).then(unwrap);

export const SEARCH_PAGE_SIZE = 20;
export const searchApi = (type, q, page, signal) =>
  api
    .get(`/search/${type}`, { params: { q, page, limit: SEARCH_PAGE_SIZE }, signal })
    .then((res) => {
      const d = unwrap(res);
      return { results: Array.isArray(d) ? d : (d?.results ?? []), total: d?.total };
    });
