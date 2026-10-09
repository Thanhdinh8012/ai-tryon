# AI Try-On — webcam + drag & drop outfit

A floating "Try-On" window for your website. The visitor opens their webcam, drags an outfit
image into the window (from Pinterest, Zara, Shopee, your own product grid, or their desktop),
and the AI re-dresses them in the camera view.

```
Browser (widget)  ──►  Your server (/api)  ──►  Gemini image model
 webcam frame           holds the API key        "put this outfit on this person"
 + dropped outfit       fetches outfit URLs safely
```

## Run it (2 minutes)

```bash
npm install
cp .env.example .env        # put your GEMINI_API_KEY in it (https://aistudio.google.com/apikey)
npm start                   # http://localhost:3000
```
No key? It starts with an offline **mock** provider so you can test the whole UI for free.

## Put it on your website

1. Host the server (any Node 20.6+ host: Render, Railway, Fly, a VPS) and set `ALLOWED_ORIGINS=https://your-shop.com`.
2. Add to your pages:

```html
<script src="https://YOUR-API-HOST/tryon-widget.js" defer></script>
<ai-tryon api="https://YOUR-API-HOST/api" lang="vi"></ai-tryon>

<!-- optional: a "Try on" button appears when hovering your product photos -->
<script>addEventListener('DOMContentLoaded', () => AITryOn.attach('.product-card img'))</script>
```

Attributes: `api`, `lang` (`en`/`vi`), `interval` (ms between live frames, default 1200), `hint` (extra style instruction), `position` (`bottom-right`/`bottom-left`), `open`.
JS: `el.tryOn(urlOrFile)`, `el.open()`, `el.close()`; events `tryon:result`, `tryon:error`.
The webcam requires **HTTPS** (localhost is exempt).

## What's included

| File | Purpose |
|---|---|
| `public/tryon-widget.js` | The whole front end: Shadow-DOM web component, draggable window, drop/paste/browse, live loop, outfit history, hold-to-compare, save photo |
| `server/server.js` | `/api/garment` (store outfit), `/api/tryon` (render frame), CORS allow-list, rate limit |
| `server/safeFetch.js` | Downloads dropped URLs safely (blocks internal IPs and redirect tricks); falls back to a page's `og:image` |
| `server/providers/gemini.js` | Gemini image model call + the try-on prompt (swap model via `GEMINI_MODEL`) |
| `server/providers/mock.js` | Free offline provider for testing |
| `test/` | Sample-image generator used by the demo page |

## Be aware (honest limits)

* **Not true 30-fps video.** Each "live" frame is a generative image edit, so expect roughly 3–10 s per refresh
  and a lag when you move. It feels live when you pose; it is not a stable video overlay. For real frame-rate
  video, add a real-time video-to-video model as a new file in `server/providers/` (same `generate()` shape);
  the widget needs no change.
* **Cost.** Every live frame is a paid API call. Raise `interval`, keep the rate limit, and consider making
  Live opt-in before launching to the public (toggle it off and each drop renders once).
* **Not tested against the real Gemini API** in this build (no key available). Everything else was tested
  end-to-end headlessly with the mock provider. If Gemini returns an error, check `GEMINI_MODEL`; for older
  models such as `gemini-2.5-flash-image` set `GEMINI_API_MODE=generateContent`.
* **Privacy.** Webcam frames are sensitive. The widget shows a consent screen and the server keeps frames only
  in memory. Add this to your privacy policy and check local rules (GDPR, Vietnam's PDPD).
* **Dragging from other sites** works because browsers hand over the image URL and the server downloads it.
  Some sites (Shopee, Zara) block bots on some images; then the user can drag a saved file or paste the image.
