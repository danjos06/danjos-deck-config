import { ICON_NAMES_RAW } from './iconNames.generated';

/** All Material Symbols names (ligatures) of the installed `material-symbols` package, sorted. */
export const MATERIAL_ICON_NAMES: readonly string[] = ICON_NAMES_RAW.split(' ');

/**
 * Searches icon names. Ranking: exact > prefix > word-start > substring (`_` and spaces are equivalent);
 * ties are broken by shorter name, then alphabetically. Empty query returns the first `limit` names.
 */
export function searchIcons(query: string, limit = 120): string[] {
  const q = query.trim().toLowerCase().replace(/[\s_]+/g, '_').replace(/^_+|_+$/g, '');
  if (q === '') return MATERIAL_ICON_NAMES.slice(0, limit);
  const scored: { name: string; rank: number }[] = [];
  for (const name of MATERIAL_ICON_NAMES) {
    let rank = -1;
    if (name === q) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (name.includes(`_${q}`)) rank = 2;
    else if (name.includes(q)) rank = 3;
    if (rank >= 0) scored.push({ name, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || (a.name < b.name ? -1 : 1));
  return scored.slice(0, limit).map((s) => s.name);
}
