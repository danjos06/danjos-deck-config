import type { Page } from '@/core/types';

/**
 * Firmware-equivalent prev/next navigation: folder pages are skipped (they are reached only
 * through a folder action), wrapping around. Shared by the 2D NavBar and the 3D nav keys.
 */
export function navTarget(pages: readonly Page[], currentId: string, step: 1 | -1): Page | null {
  const navPages = pages.filter((p) => !p.isFolder);
  const idx = navPages.findIndex((p) => p.id === currentId);
  if (idx < 0 || navPages.length < 2) return null;
  return navPages[(idx + step + navPages.length) % navPages.length];
}

export function canNavigate(pages: readonly Page[], currentId: string): boolean {
  return navTarget(pages, currentId, 1) !== null;
}
