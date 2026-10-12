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
  return names.length ? names.join(', ') : song?.subtitle || song?.more_info?.music || '';
};

export const routeFor = (item) => {
  const token = getToken(item);
  if (!token) return null;
  switch (item.type) {
    case 'album':
      return `/album/${token}`;
    case 'playlist':
      return `/playlist/${token}`;
    case 'artist':
      return `/artist/${token}`;
    case 'radio_station':
      return `/artist/${token}`;
    default:
      return null;
  }
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
