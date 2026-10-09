import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fetchImage } from './safeFetch.js';
import { createGeminiProvider } from './providers/gemini.js';
import { createMockProvider } from './providers/mock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

const PORT = Number(env.PORT || 3000);
const PROVIDER = env.PROVIDER || (env.GEMINI_API_KEY ? 'gemini' : 'mock');
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const RATE_PER_MIN = Number(env.RATE_LIMIT_PER_MIN || 30);

const provider =
  PROVIDER === 'gemini'
    ? createGeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL || 'gemini-nano-banana-2.1',
        mode: env.GEMINI_API_MODE || 'interactions',
      })
    : createMockProvider();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY === '1');
app.use(express.json({ limit: '8mb' }));

// ---- CORS: only your own site(s) may call the API from a browser -----------
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- tiny in-memory rate limiter (swap for Redis when you scale out) -------
const hits = new Map();
setInterval(() => hits.clear(), 60_000).unref();
app.use('/api', (req, res, next) => {
  const n = (hits.get(req.ip) || 0) + 1;
  hits.set(req.ip, n);
  if (n > RATE_PER_MIN) return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  next();
});

// ---- garment store: upload the outfit once, then reuse it every frame ------
const garments = new Map(); // id -> { buffer, thumb, at }
const GARMENT_TTL = 30 * 60_000;
const GARMENT_MAX = 200;
setInterval(() => {
  const now = Date.now();
  for (const [id, g] of garments) if (now - g.at > GARMENT_TTL) garments.delete(id);
}, 60_000).unref();

function parseDataUrl(s) {
  const m = /^data:image\/(png|jpe?g|webp|gif|avif);base64,([A-Za-z0-9+/=]+)$/i.exec(s || '');
  if (!m) throw Object.assign(new Error('Invalid image data'), { status: 400 });
  return Buffer.from(m[2], 'base64');
}

async function normalize(buf, max, quality = 88) {
  try {
    return await sharp(buf, { limitInputPixels: 60e6 })
      .rotate() // honour EXIF orientation, then strip metadata
      .resize(max, max, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality })
      .toBuffer();
  } catch {
    throw Object.assign(new Error('That file is not a readable image.'), { status: 400 });
  }
}

const RATIOS = { '1:1': 1, '2:3': 2 / 3, '3:2': 3 / 2, '3:4': 3 / 4, '4:3': 4 / 3, '4:5': 4 / 5, '5:4': 5 / 4, '9:16': 9 / 16, '16:9': 16 / 9 };
function nearestRatio(w, h) {
  const r = w / h;
  return Object.entries(RATIOS).sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    const status = e.status || (e.name === 'TimeoutError' ? 504 : 400);
    if (status >= 500) console.error('[tryon]', e.message);
    res.status(status).json({ error: e.message || 'Unexpected error' });
  });

app.get('/api/health', (_req, res) => res.json({ ok: true, provider: provider.name }));

app.post('/api/garment', wrap(async (req, res) => {
  const { url, dataUrl } = req.body || {};
  let raw;
  if (typeof url === 'string' && url) raw = await fetchImage(url);
  else if (typeof dataUrl === 'string') raw = parseDataUrl(dataUrl);
  else throw Object.assign(new Error('Send a url or dataUrl'), { status: 400 });

  const buffer = await normalize(raw, 1280);
  const thumb = await normalize(buffer, 240, 75);
  if (garments.size >= GARMENT_MAX) garments.delete(garments.keys().next().value);
  const id = crypto.randomUUID();
  garments.set(id, { buffer, thumb, at: Date.now() });
  res.json({ id, thumb: `data:image/jpeg;base64,${thumb.toString('base64')}` });
}));

app.post('/api/tryon', wrap(async (req, res) => {
  const { person, garmentId, hint } = req.body || {};
  const g = garments.get(garmentId);
  if (!g) throw Object.assign(new Error('Outfit expired. Drop it in again.'), { status: 410 });
  g.at = Date.now();

  const personBuf = await normalize(parseDataUrl(person), 1024, 85);
  const meta = await sharp(personBuf).metadata();
  const out = await provider.generate({
    person: personBuf,
    garment: g.buffer,
    aspectRatio: nearestRatio(meta.width, meta.height),
    hint: typeof hint === 'string' ? hint.slice(0, 200) : '',
  });
  // Nothing is written to disk; frames live only in memory for this request.
  res.json({ image: `data:${out.mime};base64,${out.buffer.toString('base64')}` });
}));

// Serve the widget + demo page (in production you can host public/ on your own CDN)
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`AI Try-On ready on http://localhost:${PORT}  (provider: ${provider.name})`);
});
