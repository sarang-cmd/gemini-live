/**
 * Background photos.
 *
 * The app ships with a dark, generated background, but it can also wear a
 * stock photo from Unsplash. The images are fetched straight from the
 * Unsplash CDN and every one of them degrades to the generated background if
 * it cannot be loaded.
 */

export interface Wallpaper {
  id: string;
  label: string;
  url: string;
}

const UNSPLASH = 'https://images.unsplash.com';

function photo(id: string, width = 1920): string {
  return `${UNSPLASH}/${id}?auto=format&fit=crop&w=${width}&q=80`;
}

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'nebula',
    label: 'Nebula',
    url: photo('photo-1462331940025-496dfbfc7564'),
  },
  {
    id: 'forest',
    label: 'Forest',
    url: photo('photo-1441974231531-c6227db76b6e'),
  },
  {
    id: 'ocean',
    label: 'Ocean',
    url: photo('photo-1505142468610-359e7d316be0'),
  },
  {
    id: 'mist',
    label: 'Mist',
    url: photo('photo-1470071459604-3b5ec3a7fe05'),
  },
  {
    id: 'orbit',
    label: 'Orbit',
    url: photo('photo-1451187580459-43490279c0fa'),
  },
];

export function wallpaperById(id: string): Wallpaper | null {
  return WALLPAPERS.find((item) => item.id === id) ?? null;
}
