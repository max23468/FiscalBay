/**
 * Immagini degli articoli dell'anteprima e delle schermate del sito: illustrazioni originali,
 * senza foto di terzi né marchi, su un fondo chiaro da catalogo. Sono data URL come le miniature
 * che l'app riceve da eBay e non chiedono altre origini.
 */
const picture = (shapes: string, defs = "") =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 96 96"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#faf6ee"/><stop offset="1" stop-color="#e2d9c7"/></linearGradient>${defs}</defs><rect width="96" height="96" fill="url(#bg)"/><ellipse cx="48" cy="84" rx="32" ry="4" fill="#000" opacity=".14"/>${shapes}</svg>`,
  )}`;

const gradient = (id: string, from: string, to: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;

const chrome = gradient("chrome", "#f8fafc", "#7b8794");
const brass = gradient("brass", "#fbe08a", "#a8701c");

export const productImages = {
  helmet: picture(
    `<path d="M 26 62C22 36 38 16 56 16c16 0 26 14 26 34v20c0 4-4 6-8 6H46c-2-10-8-14-20-14Z" fill="url(#shell)"/>
     <path d="M 55 16c12 14 16 36 14 60" fill="none" stroke="#fff" stroke-width="7"/>
     <path d="M 46 76h32" stroke="#292524" stroke-width="4" stroke-linecap="round"/>
     <path d="M 23 47c10-7 23-7 32-3l-2 7c-10-3-20-3-29 1Z" fill="#3b2a1e"/>
     <circle cx="60" cy="59" r="3.5" fill="url(#chrome)" stroke="#57534e" stroke-width=".6"/>
     <path d="M 50 76c-2 7 2 9 9 10" fill="none" stroke="#7c4a21" stroke-width="3" stroke-linecap="round"/>
     <ellipse cx="44" cy="29" rx="9" ry="5" fill="#fff" opacity=".4" transform="rotate(-35 44 29)"/>`,
    gradient("shell", "#ef4444", "#8f1313") + chrome,
  ),
  sign: picture(
    `<rect x="12" y="22" width="72" height="52" rx="5" fill="url(#enamel)" stroke="#0b2a55" stroke-width="1.5"/>
     <rect x="17" y="27" width="62" height="42" rx="3" fill="none" stroke="#fde68a" stroke-width="2"/>
     <text x="48" y="48" text-anchor="middle" font-family="Georgia,serif" font-size="14" font-weight="700" fill="#fff">GARAGE</text>
     <path d="M 26 57h44" stroke="#fde68a" stroke-width="3" stroke-linecap="round"/>
     <circle cx="17" cy="27" r="1.8" fill="url(#chrome)"/><circle cx="79" cy="27" r="1.8" fill="url(#chrome)"/><circle cx="17" cy="69" r="1.8" fill="url(#chrome)"/><circle cx="79" cy="69" r="1.8" fill="url(#chrome)"/>
     <path d="M 70 68l9-6v8Z" fill="#7f1d1d" opacity=".55"/>`,
    gradient("enamel", "#2563eb", "#0f3a7a") + chrome,
  ),
  headlight: picture(
    `<path d="M 40 74h16l3 10H37Z" fill="#57534e"/>
     <circle cx="48" cy="44" r="32" fill="url(#chrome)" stroke="#57606a" stroke-width="1"/>
     <circle cx="48" cy="44" r="25" fill="url(#glass)" stroke="#94a3b8" stroke-width="1.5"/>
     <path d="M 26 44h44M 48 22v44M 33 29l30 30M 63 29 33 59" stroke="#fff" stroke-width=".8" opacity=".55"/>
     <circle cx="48" cy="44" r="7" fill="#fffbeb"/>
     <path d="M 31 31c5-6 12-9 19-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>`,
    chrome +
      `<radialGradient id="glass"><stop offset="0" stop-color="#fffbeb"/><stop offset=".7" stop-color="#fde68a"/><stop offset="1" stop-color="#b08a3a"/></radialGradient>`,
  ),
  typewriter: picture(
    `<rect x="32" y="12" width="32" height="30" fill="#fff" stroke="#d6d3d1"/>
     <path d="M 37 20h22M 37 26h22M 37 32h14" stroke="#a8a29e" stroke-width="1.5"/>
     <rect x="18" y="36" width="60" height="9" rx="4" fill="#1c1917"/>
     <circle cx="17" cy="40" r="5" fill="url(#chrome)"/><circle cx="79" cy="40" r="5" fill="url(#chrome)"/>
     <path d="M 22 44h52l10 36H12Z" fill="url(#body)"/>
     <g fill="#f5f5f4" stroke="#1c1917" stroke-width=".8"><circle cx="28" cy="56" r="3.2"/><circle cx="38" cy="56" r="3.2"/><circle cx="48" cy="56" r="3.2"/><circle cx="58" cy="56" r="3.2"/><circle cx="68" cy="56" r="3.2"/><circle cx="24" cy="65" r="3.2"/><circle cx="34" cy="65" r="3.2"/><circle cx="44" cy="65" r="3.2"/><circle cx="54" cy="65" r="3.2"/><circle cx="64" cy="65" r="3.2"/><circle cx="74" cy="65" r="3.2"/></g>
     <rect x="32" y="71" width="32" height="5" rx="2.5" fill="#f5f5f4" stroke="#1c1917" stroke-width=".8"/>`,
    gradient("body", "#3f7a68", "#17392f") + chrome,
  ),
  horn: picture(
    `<path d="M 70 42C52 42 36 38 16 18v52c20-20 36-20 54-20Z" fill="url(#brass)" stroke="#7c5211" stroke-width="1"/>
     <ellipse cx="16" cy="44" rx="6" ry="26" fill="#6b4410"/>
     <ellipse cx="16" cy="44" rx="3" ry="18" fill="#2b1b06"/>
     <path d="M 30 32c10 6 22 9 34 10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
     <rect x="66" y="40" width="9" height="12" rx="2" fill="url(#brass)" stroke="#7c5211"/>
     <ellipse cx="82" cy="46" rx="10" ry="14" fill="url(#bulb)"/>
     <ellipse cx="79" cy="40" rx="3" ry="5" fill="#fff" opacity=".4"/>`,
    brass + gradient("bulb", "#dc2626", "#6d0f0f"),
  ),
  toolbox: picture(
    `<path d="M 36 30v-7c0-3 2-5 5-5h14c3 0 5 2 5 5v7" fill="none" stroke="url(#chrome)" stroke-width="5"/>
     <path d="M 16 44l6-16h52l6 16Z" fill="url(#lid)"/>
     <rect x="12" y="44" width="72" height="36" rx="3" fill="url(#box)"/>
     <path d="M 12 52h72" stroke="#7f1d1d" stroke-width="1.5"/>
     <rect x="27" y="43" width="9" height="14" rx="2" fill="url(#chrome)" stroke="#57606a" stroke-width=".6"/>
     <rect x="60" y="43" width="9" height="14" rx="2" fill="url(#chrome)" stroke="#57606a" stroke-width=".6"/>
     <path d="M 20 66h24" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3"/>`,
    gradient("lid", "#ef5a4a", "#b42318") + gradient("box", "#d9402f", "#7f1d1d") + chrome,
  ),
  mirror: picture(
    `<path d="M 48 62c0 8 3 14 8 22" fill="none" stroke="url(#chrome)" stroke-width="6" stroke-linecap="round"/>
     <circle cx="46" cy="36" r="27" fill="url(#chrome)" stroke="#57606a"/>
     <circle cx="46" cy="36" r="21" fill="url(#sky)"/>
     <path d="M 25 42c7-5 12-3 18 0s14 3 24-2v6a21 21 0 0 1-42 0Z" fill="#4b7a5c"/>
     <path d="M 34 22l18-6-22 26Z" fill="#fff" opacity=".4"/>`,
    chrome + gradient("sky", "#bae6fd", "#3b82c4"),
  ),
  tank: picture(
    `<path d="M 10 58C12 38 32 26 54 26c14 0 28 8 32 22 2 8-2 14-10 16-22 6-46 6-58 2-5-2-8-4-8-8Z" fill="url(#paint)" stroke="#0f5e5a" stroke-width="1"/>
     <path d="M 16 56c20-10 44-14 66-8" fill="none" stroke="#fef3c7" stroke-width="5"/>
     <rect x="42" y="18" width="16" height="9" rx="3" fill="url(#chrome)" stroke="#57606a" stroke-width=".7"/>
     <ellipse cx="50" cy="48" rx="9" ry="6" fill="#fef3c7" stroke="#b45309" stroke-width="1.2"/>
     <path d="M 26 38c8-6 18-8 28-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`,
    gradient("paint", "#2dd4bf", "#0f766e") + chrome,
  ),
  speedometer: picture(
    `<circle cx="48" cy="44" r="34" fill="url(#chrome)" stroke="#57606a"/>
     <circle cx="48" cy="44" r="28" fill="#141414"/>
     <g stroke="#f5f5f4" stroke-width="2.4" stroke-linecap="round"><path d="M 26 58l4-2.2M 22 44h5M 26 30l4 2.2M 36 20l2.4 4M 48 17v5M 60 20l-2.4 4M 70 30l-4 2.2M 74 44h-5M 70 58l-4-2.2"/></g>
     <path d="M 48 44 67 31" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
     <circle cx="48" cy="44" r="4.5" fill="url(#chrome)"/>
     <rect x="38" y="56" width="20" height="7" rx="1" fill="#f5f5f4"/>
     <path d="M 42 56v7M 46 56v7M 50 56v7M 54 56v7" stroke="#141414" stroke-width=".7"/>
     <path d="M 28 28c6-7 14-10 22-10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".35"/>`,
    chrome,
  ),
  goggles: picture(
    `<path d="M 4 46c6-3 8-3 12-2M 92 46c-6-3-8-3-12-2" fill="none" stroke="#5b3a1e" stroke-width="8" stroke-linecap="round"/>
     <path d="M 12 34c10-5 22-4 30 2 4 3 8 3 12 0 8-6 20-7 30-2 3 10 1 24-8 30-9 5-20 2-25-8-2-4-4-4-6 0-5 10-16 13-25 8-9-6-11-20-8-30Z" fill="url(#leather)"/>
     <ellipse cx="30" cy="48" rx="13" ry="12" fill="url(#lens)" stroke="url(#chrome)" stroke-width="3"/>
     <ellipse cx="66" cy="48" rx="13" ry="12" fill="url(#lens)" stroke="url(#chrome)" stroke-width="3"/>
     <path d="M 23 43l9-6M 59 43l9-6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".65"/>`,
    gradient("leather", "#8a5a2c", "#4a2c12") + gradient("lens", "#fcd34d", "#b45309") + chrome,
  ),
};
