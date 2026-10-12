import * as music from './music';

const MIN = 60 * 1000;

export const queries = {
  home: () => ({ queryKey: ['home'], queryFn: ({ signal }) => music.fetchHome(signal), staleTime: 5 * MIN }),
  song: (token) => ({ queryKey: ['song', token], queryFn: ({ signal }) => music.fetchSong(token, signal), staleTime: 30 * MIN }),
  album: (token) => ({ queryKey: ['album', token], queryFn: ({ signal }) => music.fetchAlbum(token, signal), staleTime: 30 * MIN }),
  artist: (token) => ({ queryKey: ['artist', token], queryFn: ({ signal }) => music.fetchArtist(token, signal), staleTime: 30 * MIN }),
  playlistFirstPage: (token) => ({
    queryKey: ['playlist-first', token],
    queryFn: ({ signal }) => music.fetchPlaylist(token, 1, signal),
    staleTime: 10 * MIN
  })
};
