/*!
 * AI Try-On widget  — one file, zero dependencies.
 *
 *   <script src="/tryon-widget.js" defer></script>
 *   <ai-tryon api="/api"></ai-tryon>
 *
 * Attributes: api, lang (en|vi), interval (ms between live frames), hint,
 *             position (bottom-right|bottom-left), open, live (default on)
 * Methods:    el.open(), el.close(), el.tryOn(urlOrFileOrDataUrl)
 * Events:     tryon:result {image}, tryon:error {message}
 * Global:     AITryOn.attach('.product img')  -> adds a "Try on" button to images on your own pages
 */
(() => {
  if (customElements.get('ai-tryon')) return;

  const I18N = {
    en: {
      title: 'AI Try-On', launcher: 'Try it on',
      consentTitle: 'Try clothes on yourself',
      consent: 'Your webcam frames are sent to our AI service only to generate the preview. They are not stored.',
      start: 'Start camera',
      drop: 'Drag an outfit image here', or: 'or', browse: 'browse / paste a link',
      dressing: 'Dressing you…', live: 'Live', original: 'Hold: original', save: 'Save photo', reset: 'Remove outfit',
      camDenied: 'Camera access was blocked. Allow the camera in your browser settings and try again.',
      noCam: 'No camera found on this device.',
      retry: 'Retry', pasteLink: 'Paste an image or product link',
      badDrop: 'Could not find an image in what you dropped. Try dragging the picture itself.',
      expand: 'Resize', close: 'Close', outfits: 'Recent outfits',
    },
    vi: {
      title: 'Thử đồ AI', launcher: 'Thử đồ ngay',
      consentTitle: 'Thử quần áo trên chính bạn',
      consent: 'Hình ảnh từ webcam chỉ được gửi tới dịch vụ AI để tạo bản xem trước và không được lưu lại.',
      start: 'Bật camera',
      drop: 'Kéo ảnh trang phục vào đây', or: 'hoặc', browse: 'chọn ảnh / dán link',
      dressing: 'Đang mặc đồ cho bạn…', live: 'Trực tiếp', original: 'Giữ: ảnh gốc', save: 'Lưu ảnh', reset: 'Bỏ trang phục',
      camDenied: 'Camera đang bị chặn. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.',
      noCam: 'Không tìm thấy camera trên thiết bị này.',
      retry: 'Thử lại', pasteLink: 'Dán ảnh hoặc link sản phẩm',
      badDrop: 'Không tìm thấy ảnh trong nội dung bạn kéo vào. Hãy kéo trực tiếp bức ảnh.',
      expand: 'Phóng to', close: 'Đóng', outfits: 'Trang phục gần đây',
    },
  };

  const CSS = `
  :host{all:initial;position:fixed;z-index:2147483000;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#15151a;
    --accent:#6d4aff;--bg:#fff;--line:#e7e7ee;--muted:#6b6b7a}
  *{box-sizing:border-box}
  button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
  button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .launcher{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;align-items:center;padding:12px 18px;border-radius:999px;
    background:var(--accent);color:#fff;font-weight:600;box-shadow:0 8px 24px rgba(109,74,255,.4)}
  :host([position="bottom-left"]) .launcher{right:auto;left:20px}
  .win{position:fixed;right:20px;bottom:20px;width:min(360px,calc(100vw - 24px));background:var(--bg);border:1px solid var(--line);border-radius:18px;
    box-shadow:0 20px 60px rgba(20,20,40,.28);overflow:hidden;display:none;flex-direction:column;transition:width .2s}
  :host([position="bottom-left"]) .win{right:auto;left:20px}
  .win.open{display:flex}
  .win.big{width:min(600px,calc(100vw - 24px))}
  .head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:grab;user-select:none;touch-action:none;border-bottom:1px solid var(--line)}
  .head:active{cursor:grabbing}
  .head b{flex:1;font-size:13px;letter-spacing:.2px;text-align:center}
  .ib{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--muted)}
  .ib:hover{background:#f1f1f6;color:#15151a}
  .stage{position:relative;background:#0e0e12;aspect-ratio:4/3;overflow:hidden}
  .stage video,.stage img.r{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
  .stage img.r{opacity:0;transition:opacity .35s}
  .stage img.r.on{opacity:1}
  .stage.peek img.r{opacity:0!important}
  .hint{position:absolute;left:12px;right:12px;bottom:12px;padding:9px 12px;border-radius:12px;background:rgba(20,20,28,.62);backdrop-filter:blur(8px);
    color:#fff;font-size:13px;display:flex;gap:8px;align-items:center;justify-content:center;pointer-events:none;transition:opacity .2s}
  .hint u{pointer-events:auto;cursor:pointer;text-underline-offset:2px}
  .stage.has .hint{opacity:0}
  .stage.has:hover .hint{opacity:.0}
  .stage.drag::after{content:"";position:absolute;inset:8px;border:2px dashed #fff;border-radius:14px;background:rgba(109,74,255,.35)}
  .pill{position:absolute;top:10px;left:10px;display:none;gap:6px;align-items:center;padding:5px 10px;border-radius:999px;background:rgba(20,20,28,.7);color:#fff;font-size:12px}
  .pill.on{display:flex}
  .spin{width:11px;height:11px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:s .8s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  .thumb{position:absolute;top:10px;right:10px;width:46px;height:58px;border-radius:9px;object-fit:cover;border:2px solid #fff;display:none;box-shadow:0 4px 12px rgba(0,0,0,.3)}
  .stage.has .thumb{display:block}
  .gate{position:absolute;inset:0;display:none;flex-direction:column;gap:10px;align-items:center;justify-content:center;text-align:center;padding:24px;background:#fff;z-index:3}
  .gate.on{display:flex}
  .gate h3{margin:0;font-size:16px}.gate p{margin:0;color:var(--muted);font-size:13px;max-width:280px}
  .btn{padding:10px 18px;border-radius:10px;background:var(--accent);color:#fff;font-weight:600}
  .err{margin:0;padding:8px 12px;background:#fff1f1;color:#b42318;font-size:12.5px;display:none}.err.on{display:block}
  .bar{display:flex;gap:6px;align-items:center;padding:10px 12px;flex-wrap:wrap}
  .chip{padding:6px 10px;border-radius:9px;border:1px solid var(--line);font-size:12.5px;display:flex;gap:6px;align-items:center}
  .chip:hover{background:#f6f6fa}.chip[aria-pressed=true]{background:#efeaff;border-color:var(--accent);color:var(--accent);font-weight:600}
  .chip[disabled]{opacity:.4;pointer-events:none}
  .sp{flex:1}
  .hist{display:flex;gap:6px;padding:0 12px 12px;overflow-x:auto}.hist:empty{display:none}
  .hist button{flex:none;width:40px;height:50px;border-radius:8px;overflow:hidden;border:2px solid transparent;padding:0}
  .hist button[aria-current=true]{border-color:var(--accent)}
  .hist img{width:100%;height:100%;object-fit:cover;display:block}
  input[type=file]{display:none}
  .host-try{position:fixed;z-index:2147482999;padding:6px 10px;border-radius:999px;background:#6d4aff;color:#fff;font:600 12px system-ui;border:0;cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.3);display:none}
  `;

  const ICON = {
    shirt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0Z"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    big: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // ------- turn whatever the user dropped into {url} | {dataUrl} -------------
  function upgradePinterest(u) {
    try {
      const x = new URL(u);
      if (/(^|\.)pinimg\.com$/.test(x.hostname)) x.pathname = x.pathname.replace(/^\/\d+x\//, '/736x/');
      return x.toString();
    } catch { return u; }
  }
  function blobToDataUrl(b) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  }
  async function shrink(blob, max = 1280) {
    try {
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.9);
    } catch { return blobToDataUrl(blob); }
  }
  const isHttp = (s) => /^https?:\/\//i.test(s || '');

  async function extractGarment(dt) {
    // 1) real files (dragged from the desktop / file manager)
    for (const f of dt.files || []) if (f.type.startsWith('image/')) return { dataUrl: await shrink(f) };
    // 2) dragged <img> from another page: text/html carries the true image source
    const html = dt.getData('text/html');
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const img = doc.querySelector('img');
      if (img) {
        const srcset = img.getAttribute('srcset');
        let src = img.getAttribute('src') || '';
        if (srcset) { // pick the widest candidate
          const best = srcset.split(',').map((s) => s.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1] || 0) - parseFloat(a[1] || 0))[0];
          if (best && best[0]) src = best[0];
        }
        if (src.startsWith('data:image/')) return { dataUrl: src };
        if (src.startsWith('blob:')) { try { return { dataUrl: await shrink(await (await fetch(src)).blob()) }; } catch { /* fall through */ } }
        if (isHttp(src)) return { url: upgradePinterest(src) };
      }
    }
    // 3) plain URL (uri-list / text)
    const uri = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').split(/\r?\n/).find((l) => l && !l.startsWith('#'));
    if (isHttp(uri)) return { url: upgradePinterest(uri.trim()) };
    return null;
  }

  class AITryOn extends HTMLElement {
    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
      this.st = { garmentId: null, garmentSrc: null, history: [], token: 0, running: false, stream: null, live: true, busy: false };
    }

    get api() { return (this.getAttribute('api') || '/api').replace(/\/$/, ''); }
    get t() {
      const l = (this.getAttribute('lang') || document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
      return I18N[l] || I18N.en;
    }

    connectedCallback() {
      this.render();
      if (this.hasAttribute('open')) this.open();
    }
    disconnectedCallback() { this.stopCamera(); this.st.token++; }

    // ---------------------------------------------------------------- UI ----
    render() {
      const t = this.t;
      this.root.innerHTML = `
      <style>${CSS}</style>
      <button class="launcher" part="launcher">${ICON.shirt}<span>${t.launcher}</span></button>
      <section class="win" role="dialog" aria-label="${t.title}">
        <div class="head"><span style="width:28px"></span><b>${t.title}</b>
          <button class="ib big" title="${t.expand}" aria-label="${t.expand}">${ICON.big}</button>
          <button class="ib shut" title="${t.close}" aria-label="${t.close}">${ICON.x}</button></div>
        <div class="stage">
          <video playsinline muted autoplay></video>
          <img class="r a" alt=""><img class="r b" alt="">
          <div class="pill"><i class="spin"></i><span>${t.dressing}</span></div>
          <img class="thumb" alt="">
          <div class="hint"><span>${ICON.shirt}</span><span>${t.drop} · <u class="browse">${t.browse}</u></span></div>
          <div class="gate on"><h3>${t.consentTitle}</h3><p>${t.consent}</p><button class="btn go">${t.start}</button></div>
        </div>
        <p class="err" role="alert"></p>
        <div class="bar">
          <button class="chip live" aria-pressed="true"><i class="spin" style="border-color:#c9bdff;border-top-color:var(--accent);display:none"></i>● ${t.live}</button>
          <button class="chip peek" disabled>${t.original}</button>
          <span class="sp"></span>
          <button class="chip save" disabled>${t.save}</button>
          <button class="chip reset" disabled>${t.reset}</button>
        </div>
        <div class="hist" aria-label="${t.outfits}"></div>
        <input type="file" accept="image/*">
      </section>`;
      const $ = (s) => this.root.querySelector(s);
      this.el = { win: $('.win'), stage: $('.stage'), video: $('video'), a: $('.r.a'), b: $('.r.b'), pill: $('.pill'), thumb: $('.thumb'),
        gate: $('.gate'), err: $('.err'), live: $('.live'), peek: $('.peek'), save: $('.save'), reset: $('.reset'), hist: $('.hist'), file: $('input[type=file]') };
      this.front = 'a';

      $('.launcher').onclick = () => this.open();
      $('.shut').onclick = () => this.close();
      $('.big').onclick = () => this.el.win.classList.toggle('big');
      $('.go').onclick = () => { store.set('aitryon-consent', '1'); this.startCamera(); };
      $('.browse').onclick = () => this.promptForSource();
      this.el.file.onchange = async () => { const f = this.el.file.files[0]; this.el.file.value = ''; if (f) this.tryOn(f); };
      this.el.live.onclick = () => {
        this.st.live = !this.st.live; this.el.live.setAttribute('aria-pressed', this.st.live);
        if (this.st.live) this.loop(); else this.st.token++;
      };
      this.el.reset.onclick = () => this.clearOutfit();
      this.el.save.onclick = () => this.savePhoto();
      const peekOn = () => this.el.stage.classList.add('peek'), peekOff = () => this.el.stage.classList.remove('peek');
      this.el.peek.addEventListener('pointerdown', peekOn);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => this.el.peek.addEventListener(e, peekOff));

      this.bindDrag();
      this.bindWindowMove($('.head'));
      this.root.addEventListener('paste', (e) => this.onPaste(e));
      document.addEventListener('paste', (e) => { if (this.el.win.classList.contains('open')) this.onPaste(e); });
    }

    open() {
      this.el.win.classList.add('open');
      this.root.querySelector('.launcher').style.display = 'none';
      if (store.get('aitryon-consent') === '1') this.startCamera();
    }
    close() {
      this.el.win.classList.remove('open');
      this.root.querySelector('.launcher').style.display = '';
      this.stopCamera(); this.st.token++;
    }

    // ------------------------------------------------------------ camera ----
    async startCamera() {
      this.showError('');
      try {
        this.st.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      } catch (e) {
        this.el.gate.classList.add('on');
        this.showError(e && e.name === 'NotFoundError' ? this.t.noCam : this.t.camDenied);
        return;
      }
      const v = this.el.video;
      v.srcObject = this.st.stream;
      await v.play().catch(() => {});
      await new Promise((r) => (v.videoWidth ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
      this.el.stage.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
      this.el.gate.classList.remove('on');
      if (this.st.garmentId) this.loop();
    }
    stopCamera() {
      this.st.stream?.getTracks().forEach((t) => t.stop());
      this.st.stream = null;
    }
    captureFrame() {
      const v = this.el.video;
      if (!v.videoWidth) return null;
      const k = Math.min(1, 768 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);   // un-mirrored raw frame
      return c.toDataURL('image/jpeg', 0.85);
    }

    // ------------------------------------------------------ drag & drop -----
    bindDrag() {
      let depth = 0;
      const w = this.el.win, s = this.el.stage;
      const has = (e) => [...(e.dataTransfer?.types || [])].some((t) => ['Files', 'text/uri-list', 'text/html', 'text/plain'].includes(t));
      w.addEventListener('dragenter', (e) => { if (!has(e)) return; e.preventDefault(); depth++; s.classList.add('drag'); });
      w.addEventListener('dragover', (e) => { if (!has(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
      w.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) s.classList.remove('drag'); });
      w.addEventListener('drop', async (e) => {
        e.preventDefault(); depth = 0; s.classList.remove('drag');
        const g = await extractGarment(e.dataTransfer).catch(() => null);
        g ? this.tryOn(g) : this.showError(this.t.badDrop);
      });
    }
    async onPaste(e) {
      const cd = e.clipboardData; if (!cd) return;
      const f = [...cd.files].find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); return this.tryOn(f); }
      const txt = (cd.getData('text/plain') || '').trim();
      if (isHttp(txt)) { e.preventDefault(); this.tryOn(upgradePinterest(txt)); }
    }
    promptForSource() {
      const link = window.prompt(this.t.pasteLink + ' (OK) / ' + 'Cancel → file');
      if (link && isHttp(link.trim())) return this.tryOn(upgradePinterest(link.trim()));
      if (link === null) this.el.file.click();
    }

    bindWindowMove(handle) {
      let sx, sy, ox, oy, moving = false;
      handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const r = this.el.win.getBoundingClientRect();
        Object.assign(this.el.win.style, { left: r.left + 'px', top: r.top + 'px', right: 'auto', bottom: 'auto' });
        sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; moving = true; handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', (e) => {
        if (!moving) return;
        const r = this.el.win.getBoundingClientRect();
        const x = Math.min(Math.max(0, ox + e.clientX - sx), innerWidth - r.width);
        const y = Math.min(Math.max(0, oy + e.clientY - sy), innerHeight - 60);
        this.el.win.style.left = x + 'px'; this.el.win.style.top = y + 'px';
      });
      handle.addEventListener('pointerup', () => { moving = false; });
    }

    // ------------------------------------------------------- try-on core ----
    /** Public: dress the user in an outfit. Accepts a URL, a data: URL, a File/Blob or {url|dataUrl}. */
    async tryOn(src) {
      this.open();
      this.showError('');
      let g = src;
      try {
        if (src instanceof Blob) g = { dataUrl: await shrink(src) };
        else if (typeof src === 'string') g = src.startsWith('data:') ? { dataUrl: src } : { url: src };
        this.busy(true);
        const r = await this.post('/garment', g);
        this.st.garmentId = r.id; this.st.garmentSrc = g;
        this.el.thumb.src = r.thumb;
        this.pushHistory(r.id, r.thumb, g);
        this.el.stage.classList.add('has');
        ['save', 'reset', 'peek'].forEach((k) => this.el[k].removeAttribute('disabled'));
        this.st.token++;
        this.loop(true);
      } catch (e) { this.fail(e); this.busy(false); }
    }

    pushHistory(id, thumb, src) {
      const h = this.st.history.filter((x) => x.thumb !== thumb);
      h.unshift({ id, thumb, src }); this.st.history = h.slice(0, 8);
      this.el.hist.innerHTML = '';
      for (const it of this.st.history) {
        const b = document.createElement('button');
        b.innerHTML = `<img alt="" src="${it.thumb}">`;
        if (it.id === this.st.garmentId) b.setAttribute('aria-current', 'true');
        b.onclick = () => { this.st.garmentId = it.id; this.st.garmentSrc = it.src; this.el.thumb.src = it.thumb; this.pushHistory(it.id, it.thumb, it.src); this.st.token++; this.loop(true); };
        this.el.hist.appendChild(b);
      }
    }

    /** Render loop. First pass is always one shot; stays running only in Live mode. */
    async loop(force = false) {
      const my = ++this.st.token;
      const interval = Number(this.getAttribute('interval') || 1200);
      let first = true;
      while (my === this.st.token && this.st.garmentId && this.st.stream && (first || this.st.live)) {
        if (!first && document.hidden) { await sleep(500); continue; }
        first = false;
        const t0 = performance.now();
        const frame = this.captureFrame();
        if (!frame) { await sleep(300); continue; }
        this.busy(true);
        try {
          const r = await this.post('/tryon', { person: frame, garmentId: this.st.garmentId, hint: this.getAttribute('hint') || '' });
          if (my !== this.st.token) return;
          this.showResult(r.image);
          this.dispatchEvent(new CustomEvent('tryon:result', { detail: { image: r.image } }));
          this.showError('');
        } catch (e) {
          if (my !== this.st.token) return;
          if (e.status === 410 && this.st.garmentSrc) {          // server forgot the outfit -> re-register silently
            try { const r = await this.post('/garment', this.st.garmentSrc); this.st.garmentId = r.id; continue; } catch { /* fallthrough */ }
          }
          this.fail(e);
          if (e.status === 429) await sleep(5000); else if (!this.st.live) break; else await sleep(3000);
        }
        this.busy(false);
        await sleep(Math.max(0, interval - (performance.now() - t0)));
      }
      if (my === this.st.token) this.busy(false);
    }

    showResult(src) {
      const next = this.front === 'a' ? 'b' : 'a';
      const incoming = this.el[next], outgoing = this.el[this.front];
      incoming.onload = () => { incoming.classList.add('on'); setTimeout(() => outgoing.classList.remove('on'), 360); this.front = next; };
      incoming.src = src;
    }

    clearOutfit() {
      this.st.token++; this.st.garmentId = null;
      this.el.a.classList.remove('on'); this.el.b.classList.remove('on');
      this.el.stage.classList.remove('has'); this.busy(false);
      ['save', 'reset', 'peek'].forEach((k) => this.el[k].setAttribute('disabled', ''));
      this.el.hist.querySelectorAll('[aria-current]').forEach((n) => n.removeAttribute('aria-current'));
    }

    savePhoto() {
      const img = this.el[this.front]; if (!img.src) return;
      const a = document.createElement('a'); a.href = img.src; a.download = 'try-on.jpg'; a.click();
    }

    // --------------------------------------------------------------- misc ---
    busy(on) { this.el.pill.classList.toggle('on', on); }
    showError(m) { this.el.err.textContent = m || ''; this.el.err.classList.toggle('on', !!m); }
    fail(e) {
      this.showError(e.message || String(e));
      this.dispatchEvent(new CustomEvent('tryon:error', { detail: { message: e.message } }));
    }
    async post(path, body) {
      const res = await fetch(this.api + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(j.error || `Request failed (${res.status})`), { status: res.status });
      return j;
    }
  }
  customElements.define('ai-tryon', AITryOn);

  // ---- "Try on" buttons on your own product images --------------------------
  window.AITryOn = {
    attach(selector, widgetSelector = 'ai-tryon') {
      const btn = document.createElement('button');
      btn.className = 'host-try'; btn.textContent = '👕 ' + (document.documentElement.lang?.startsWith('vi') ? 'Thử đồ' : 'Try on');
      Object.assign(btn.style, { position: 'fixed', zIndex: 2147482999, padding: '6px 10px', borderRadius: '999px', background: '#6d4aff', color: '#fff',
        font: '600 12px system-ui', border: '0', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.3)', display: 'none' });
      document.body.appendChild(btn);
      let cur = null, hideT;
      const show = (img) => {
        clearTimeout(hideT); cur = img; const r = img.getBoundingClientRect();
        btn.style.display = 'block'; btn.style.top = Math.max(4, r.top + 8) + 'px'; btn.style.left = Math.max(4, r.right - btn.offsetWidth - 8) + 'px';
      };
      document.addEventListener('pointerover', (e) => { const i = e.target.closest?.(selector); if (i && i.tagName === 'IMG') show(i); else if (e.target === btn) clearTimeout(hideT); });
      document.addEventListener('pointerout', (e) => { if (e.target.closest?.(selector) || e.target === btn) hideT = setTimeout(() => { btn.style.display = 'none'; }, 250); });
      btn.onclick = () => { const w = document.querySelector(widgetSelector); if (w && cur) w.tryOn(cur.currentSrc || cur.src); };
    },
  };
})();
