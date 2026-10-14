# Waves – React music frontend

Vite + React 18 + React Router + TanStack Query + Zustand. Talks to the JioSaavn Express backend.

## Features
- Home: **New Trending, Top Playlists, New Albums, Charts, Podcasts, Radio Stations, Recommended Artists, Top in Your City** (scrollable rows, hover-play)
- Search (songs / albums / playlists / artists) with debounce, URL-shareable state and load-more
- Album, playlist (paginated), artist and **podcast** pages (seasons, episodes with duration/plays, play-all)
- Player: play/pause, next/prev, seek, volume/mute, shuffle, repeat (off/all/one), automatic bitrate (48–320 kbps) based on connection type, measured download speed and stalls,
  queue from any list, Media Session (lock screen / media keys), Space bar shortcut, auto-skip on broken tracks
- **Installable PWA** (manifest, icons, offline app shell, cached API/images, update prompt, install button, iOS hint)
- **Background-safe playback**: audio engine runs outside React; next track starts synchronously on `ended` and on
  lock-screen next/previous; next track is pre-loaded for near gap-less transitions; last track + position restored
- Skeleton loaders, error + empty states, error boundary, toasts, lazy-loaded routes
- Mobile-first responsive UI: mini player + full-screen Now Playing sheet, touch-friendly controls, safe-area (notch) support

## Run
```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:5173  (proxies /api -> http://localhost:5000)
npm run build        # outputs dist/
```

## Config
`VITE_API_BASE_URL` is baked in at build time.
- Same origin (nginx/ingress proxies `/api` to the backend): `/api/v1`
- Different domain: `https://api.example.com/api/v1` **and** add the site origin to the backend `CORS_ORIGINS`.

## Docker
```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 -t waves-web .
docker run -p 8080:80 waves-web
```

## PWA notes
- Service worker: precaches the app shell; API (`/api/v1/*`) is network-first, images cache-first. **Audio is never cached.**
- Updates are never applied automatically (a reload would stop the music) – users get a "Refresh" banner.
- Serve over HTTPS (or localhost). `sw.js` and `manifest.webmanifest` must not be cached long (see `nginx.conf`).
- Test with `npm run build && npm run preview`, then Chrome DevTools → Application → Manifest / Service Workers.
- If the API is on another origin, allow it in the backend `CORS_ORIGINS`.

- **Radio stations**: tap to play instantly (no detail page) - one call starts the station and plays a random-feeling stream; the player fetches and appends more songs on its own as the queue runs low, forever

- **Go to Album**: on desktop, the cover/title in the player links straight to the album when one exists (no extra button); on mobile, a small "Go to Album" link sits in the full-screen Now Playing sheet and closes it on tap. Hidden entirely for radio/podcast tracks with no album.

## Tests
`npm test` – includes regression tests for background track-advance, pre-loading, repeat/shuffle and lock-screen controls.
