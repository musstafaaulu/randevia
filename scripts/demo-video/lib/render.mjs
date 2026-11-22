// Renders a self-contained HTML string to a PNG via a throwaway Chromium
// page - used for the intro/outro title cards and the caption-bar overlays,
// so both are drawn with real CSS (gradients, the app's own SVG logo,
// proper Turkish-character font shaping) instead of ffmpeg's drawtext.
export async function renderHtml(browser, html, outPath, { width = 1920, height = 1080, transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  if (transparent) {
    await page.addStyleTag({ content: 'html,body{background:transparent !important;}' });
  }
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: outPath, omitBackground: transparent });
  await page.close();
}

const LOGO_MARK = `
<svg viewBox="0 0 48 48" class="logo-mark" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2dd4bf" />
      <stop offset="1" stop-color="#0f766e" />
    </linearGradient>
    <clipPath id="card"><rect x="10.5" y="12" width="27" height="25.5" rx="5.25" /></clipPath>
  </defs>
  <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="url(#g)" />
  <rect x="15" y="5.25" width="3.75" height="10.5" rx="1.9" fill="#fff" opacity="0.9" />
  <rect x="29.25" y="5.25" width="3.75" height="10.5" rx="1.9" fill="#fff" opacity="0.9" />
  <g clip-path="url(#card)">
    <rect x="10.5" y="12" width="27" height="25.5" fill="#fff" />
    <rect x="10.5" y="12" width="27" height="8.25" fill="#2563eb" />
  </g>
  <path d="M14.75 31 h3.75 l1.9 -6.75 l3 12 l2.25 -9 l1.5 3.75 h6.4"
    fill="none" stroke="#0f766e" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const FONT_STACK = `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

export function titleCardHtml({ tagline, badges }) {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1920px; height:1080px; font-family:${FONT_STACK}; }
    body {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background: radial-gradient(circle at 30% 20%, #134e4a 0%, #0f172a 55%, #0b1120 100%);
      color:#f8fafc;
    }
    .logo-mark { width:120px; height:120px; filter: drop-shadow(0 8px 24px rgba(45,212,191,.35)); }
    h1 { font-size:88px; font-weight:800; letter-spacing:-2px; margin-top:36px; }
    p.tagline { font-size:34px; color:#5eead4; margin-top:18px; font-weight:500; }
    .badges { display:flex; gap:18px; margin-top:56px; }
    .badge {
      padding:12px 26px; border-radius:999px; font-size:22px; font-weight:600;
      background:rgba(255,255,255,.06); border:1px solid rgba(94,234,212,.35); color:#e2e8f0;
    }
  </style></head><body>
    ${LOGO_MARK}
    <h1>Randevia</h1>
    <p class="tagline">${tagline}</p>
    <div class="badges">${badges.map((b) => `<span class="badge">${b}</span>`).join('')}</div>
  </body></html>`;
}

export function outroCardHtml({ developerLabel }) {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1920px; height:1080px; font-family:${FONT_STACK}; }
    body {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background: radial-gradient(circle at 70% 80%, #134e4a 0%, #0f172a 55%, #0b1120 100%);
      color:#f8fafc;
    }
    .logo-mark { width:100px; height:100px; }
    h1 { font-size:64px; font-weight:800; letter-spacing:-1.5px; margin-top:28px; }
    p.repo { font-size:30px; color:#5eead4; margin-top:28px; font-weight:600; }
    p.dev { font-size:24px; color:#94a3b8; margin-top:14px; }
  </style></head><body>
    ${LOGO_MARK}
    <h1>Randevia</h1>
    <p class="repo">github.com/musstafaaulu/randevia</p>
    <p class="dev">${developerLabel}</p>
  </body></html>`;
}

// A subtitle bar: a semi-transparent dark strip across the bottom of the
// frame with one large, centered line of narration - screenshotted with a
// transparent background and time-windowed onto the recorded clip via
// ffmpeg's overlay `enable` expression (see 07-assemble.mjs), synced to the
// real timestamp it was logged at during recording.
export function captionHtml({ title, subtitle }) {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1920px; height:1080px; font-family:${FONT_STACK}; background:transparent; }
    .bar {
      position:absolute; left:0; right:0; bottom:0; padding:28px 90px 50px;
      display:flex; flex-direction:column; align-items:center; text-align:center;
      background: linear-gradient(to top, rgba(2,6,23,.88) 0%, rgba(2,6,23,.82) 60%, rgba(2,6,23,0) 100%);
    }
    .accent { width:64px; height:5px; border-radius:3px; background:#2dd4bf; margin-bottom:16px; }
    h2 { font-size:46px; line-height:1.25; font-weight:700; color:#f8fafc; letter-spacing:-0.3px; text-shadow: 0 2px 10px rgba(0,0,0,.5); }
    p { font-size:25px; color:#cbd5e1; margin-top:10px; font-weight:400; }
  </style></head><body>
    <div class="bar">
      <div class="accent"></div>
      <h2>${title}</h2>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
  </body></html>`;
}
