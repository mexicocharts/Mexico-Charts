import {canonicalArtistCatalog, canonicalArtistHref} from './artistRoutes.mjs';

// The established canonical inventory supplies navigation, never live statistics.
export const artistIndexEntries = Object.freeze(canonicalArtistCatalog
  .map(artist => ({name:artist.name, href:canonicalArtistHref(artist.path)}))
  .filter(artist => artist.href)
  .sort((a,b) => a.name.localeCompare(b.name,'es',{sensitivity:'base'})));

function escapeHtml(value) {
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

export function renderArtistIndex(language = 'es') {
  const en = language === 'en';
  const label = en ? 'Artist index A–Z' : 'Índice de artistas A–Z';
  const description = en ? 'Browse the artist profiles in our catalog.' : 'Explora los perfiles de artistas de nuestro catálogo.';
  const links = artistIndexEntries.map(artist => `<li><a class="inline-block py-1 text-zinc-300 hover:text-[#39FF14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39FF14]" href="${escapeHtml(artist.href)}">${escapeHtml(artist.name)}</a></li>`).join('');
  return `<details class="max-w-[1400px] mx-auto px-6 py-6 border-t border-white/10 text-white"><summary class="cursor-pointer text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#39FF14]">${label}</summary><p class="my-4 text-sm text-zinc-400">${description}</p><nav aria-label="${label}"><ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 text-sm">${links}</ul></nav></details>`;
}
