// Gemini image-editing provider ("Nano Banana" family).
//
// Default: the Interactions API  (POST /v1beta/interactions)  -> GEMINI_API_MODE=interactions
// Legacy : generateContent                                    -> GEMINI_API_MODE=generateContent
// Model is configurable, so you can swap in newer/faster models without code changes.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function buildPrompt(hint = '') {
  return [
    'This is a virtual try-on task.',
    'Image 1 is a live photo of a person. Image 2 shows an outfit or garment (it may be worn by a model, or flat-lay).',
    'Produce a photorealistic photo of the SAME person from image 1 wearing the outfit from image 2.',
    'Keep the person\'s face, identity, skin tone, hair, hands, body shape, pose, expression, background, lighting and camera framing exactly as in image 1.',
    'Only the clothing changes. Reproduce the outfit\'s colours, fabric, pattern, logos, layering and fit faithfully, and drape it naturally on the person\'s body and pose.',
    'If image 2 contains several garments, dress the person in the complete look (top, bottom, outerwear, and visible accessories such as hats or bags).',
    'Do not add text, watermarks or borders. Return only the final image.',
    hint ? `Extra instruction: ${hint}` : '',
  ].filter(Boolean).join(' ');
}

// Find the first base64 image block anywhere in the response (works across API shapes).
function findImage(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findImage(n); if (r) return r; }
    return null;
  }
  const mime = node.mime_type || node.mimeType;
  const data = node.data;
  if (typeof data === 'string' && data.length > 200 && typeof mime === 'string' && mime.startsWith('image/')) {
    return { mime, data };
  }
  if (node.inlineData) { const r = findImage(node.inlineData); if (r) return r; }
  if (node.inline_data) { const r = findImage(node.inline_data); if (r) return r; }
  for (const k of Object.keys(node)) { const r = findImage(node[k]); if (r) return r; }
  return null;
}

export function createGeminiProvider({ apiKey, model, mode = 'interactions', timeoutMs = 60000 }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Copy .env.example to .env and set it.');

  return {
    name: `gemini:${model}`,
    async generate({ person, garment, aspectRatio = '4:3', hint = '' }) {
      const text = buildPrompt(hint);
      const personB64 = person.toString('base64');
      const garmentB64 = garment.toString('base64');

      let url, body;
      if (mode === 'generateContent') {
        url = `${BASE}/models/${model}:generateContent`;
        body = {
          contents: [{ parts: [
            { text },
            { inline_data: { mime_type: 'image/jpeg', data: personB64 } },
            { inline_data: { mime_type: 'image/jpeg', data: garmentB64 } },
          ] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
        };
      } else {
        url = `${BASE}/interactions`;
        body = {
          model,
          input: [
            { type: 'text', text },
            { type: 'image', mime_type: 'image/jpeg', data: personB64 },
            { type: 'image', mime_type: 'image/jpeg', data: garmentB64 },
          ],
          response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspectRatio },
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error?.message || `Gemini error ${res.status}`;
        const err = new Error(msg);
        err.status = res.status === 429 ? 429 : 502;
        throw err;
      }
      const img = findImage(json);
      if (!img) {
        const err = new Error('The model returned no image (it may have been blocked by safety filters). Try another photo or outfit.');
        err.status = 422;
        throw err;
      }
      return { buffer: Buffer.from(img.data, 'base64'), mime: img.mime };
    },
  };
}
