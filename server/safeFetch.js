// SSRF-safe image downloader. Users can drop ANY url, so the server must never
// be tricked into calling internal addresses (127.0.0.1, 10.x, cloud metadata...).
import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 4;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')) return true;
    const m = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateIp(m[1]);
    return false;
  }
  return true;
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Blocked address');
    return;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length || records.some((r) => isPrivateIp(r.address))) {
    throw new Error('Blocked address');
  }
}

async function readLimited(res) {
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > MAX_BYTES) throw new Error('File too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function get(url, hop = 0) {
  if (hop > MAX_REDIRECTS) throw new Error('Too many redirects');
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) URLs are allowed');
  await assertPublicHost(u.hostname);

  const res = await fetch(u, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': UA, accept: 'image/*,text/html;q=0.8,*/*;q=0.5', referer: u.origin + '/' },
  });
  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    return get(new URL(res.headers.get('location'), u).toString(), hop + 1);
  }
  if (!res.ok) throw new Error(`Remote server answered ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) throw new Error('File too large');
  return { type, buffer: await readLimited(res), url: u.toString() };
}

/**
 * Download an image from a URL. If the URL is a product *page* (Zara, Shopee...),
 * fall back to its og:image / twitter:image meta tag.
 */
export async function fetchImage(url) {
  const first = await get(url);
  if (first.type.startsWith('image/')) return first.buffer;

  if (first.type.includes('html')) {
    const html = first.buffer.toString('utf8', 0, 600_000);
    const m =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    if (m) {
      const img = await get(new URL(m[1].replace(/&amp;/g, '&'), first.url).toString());
      if (img.type.startsWith('image/')) return img.buffer;
    }
  }
  throw new Error('That link does not contain a usable image. Drag the image itself instead.');
}
