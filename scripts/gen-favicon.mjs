#!/usr/bin/env node
// Writes public/favicon.svg from the shared logo geometry (mark only, brand accent). npm run gen:favicon
import { writeFileSync } from 'node:fs';
import { MARK, markPaths } from '../src/components/brand/logoGeometry.ts';

const ACCENT = '#1fb6d6'; // keep in sync with --accent in src/index.css
const pad = 20;
const w = MARK.width + pad * 2;
const h = MARK.height + pad * 2;
const s = Math.max(w, h);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-(s - MARK.width) / 2} ${-(s - MARK.height) / 2} ${s} ${s}">
<g fill="none" stroke="${ACCENT}" stroke-width="${MARK.stroke + 4}" stroke-linejoin="round">
${markPaths().map((d) => `<path d="${d}"/>`).join('\n')}
</g>
</svg>
`;
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg);
console.log('public/favicon.svg written');
