import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';

const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AlbumPage = lazy(() => import('./pages/AlbumPage'));
const PlaylistPage = lazy(() => import('./pages/PlaylistPage'));
const ArtistPage = lazy(() => import('./pages/ArtistPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="album/:token" element={<AlbumPage />} />
        <Route path="playlist/:token" element={<PlaylistPage />} />
        <Route path="artist/:token" element={<ArtistPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
