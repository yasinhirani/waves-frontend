export const formatDuration = (seconds) => {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '0:00';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n);
};

/** image is an array of { quality, url } produced by the backend */
export const getImage = (image, quality = '500x500') => {
  if (Array.isArray(image)) return (image.find((i) => i.quality === quality) ?? image.at(-1))?.url ?? '';
  return typeof image === 'string' ? image : '';
};

export const getImageSrcSet = (image) =>
  Array.isArray(image) && image.length
    ? `${getImage(image, '150x150')} 150w, ${getImage(image, '500x500')} 500w`
    : undefined;

const BITRATES = ['12kbps', '48kbps', '96kbps', '160kbps', '320kbps'];

/** Exact quality if present, otherwise the closest lower one. */
export const pickDownloadUrl = (links, quality = '160kbps') => {
  if (!Array.isArray(links) || !links.length) return '';
  for (let i = BITRATES.indexOf(quality); i >= 0; i--) {
    const link = links.find((l) => l.quality === BITRATES[i]);
    if (link) return link.url;
  }
  return links.at(-1).url;
};

export const hasAudio = (song) => Array.isArray(song?.downloadUrl) && song.downloadUrl.length > 0;

export const getToken = (item) =>
  item?.token ?? item?.perma_url?.split('?')[0].split('/').filter(Boolean).at(-1);

export const getPrimaryArtists = (song) => song?.more_info?.artistMap?.primary_artists ?? [];

export const artistText = (song) => {
  const names = getPrimaryArtists(song).map((a) => a.name).filter(Boolean);
  return names.length ? names.join(', ') : song?.subtitle || song?.more_info?.music || song?.more_info?.show_title || '';
};

export const routeFor = (item) => {
  const token = getToken(item);
  if (!token) return null;
  const type = item.type === 'radio_station' && item?.more_info?.featured_station_type === 'artist' ? item?.more_info?.featured_station_type : item.type
  switch (type) {
    case 'album':
      return `/album/${token}`;
    case 'playlist':
      return `/playlist/${token}`;
    case 'artist':
      return `/artist/${token}`;
    case 'show':
      return `/podcast/${token}`;
    default:
      return null;
  }
};

/** "https://www.jiosaavn.com/album/sanam/VmgbE5WLvYw_" -> "VmgbE5WLvYw_" (same shape as perma_url tokens) */
export const getAlbumToken = (song) => {
  const url = song?.more_info?.album_url;
  if (typeof url !== 'string' || !url) return undefined;
  return url.split('?')[0].split('/').filter(Boolean).pop();
};

export const parseBio = (bio) => {
  if (!bio || typeof bio !== 'string') return '';
  try {
    const parsed = JSON.parse(bio);
    if (Array.isArray(parsed)) return parsed.map((b) => b.text).filter(Boolean).join('\n\n');
  } catch {
    /* not JSON */
  }
  return bio.trim().startsWith('[') ? '' : bio;
};

/** 336 -> "6 min", 3900 -> "1 hr 5 min" (podcast episodes) */
export const formatEpisodeDuration = (seconds) => {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '';
  const mins = Math.max(1, Math.round(n / 60));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr${mins % 60 ? ` ${mins % 60} min` : ''}`;
};

export const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Podcast episodes are a single MP3: every "quality" link is the same URL (no bitrate ladder). */
export const hasSingleSource = (song) => {
  const links = song?.downloadUrl;
  return Array.isArray(links) && links.length > 0 && new Set(links.map((l) => l.url)).size === 1;
};
