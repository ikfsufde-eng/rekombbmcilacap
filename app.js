const $ = id => document.getElementById(id);
const DEFAULT_URL = 'https://sites.google.com/view/rekombbmcilacap/halaman-muka';

// ---------- Toast ----------
let toastT;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000);
}

// ---------- Tab (iframe dimuat saat pertama kali dibuka) ----------
function loadPanel(panel) {
  const f = panel.querySelector('iframe[data-src]');
  if (!f) return;
  f.addEventListener('load', () => panel.querySelector('.loader')?.classList.add('done'), { once: true });
  f.src = f.dataset.src; f.removeAttribute('data-src');
  setTimeout(() => panel.querySelector('.loader')?.classList.add('done'), 15000); // jaga-jaga
}
function switchTab(tabId) {
  const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (!btn) return;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const panel = $(tabId);
  panel.classList.add('active'); btn.classList.add('active');
  $('app-title').textContent = btn.dataset.title;
  loadPanel(panel);
  if (tabId === 'tab4') {
    setTimeout(aturModeDesktop, 30);
    if (!$('linkInput').value) $('linkInput').value = DEFAULT_URL;
  }
  else if (typeof tutupScan === 'function') tutupScan();
  try { localStorage.setItem('lastTab', tabId); } catch (e) {}
}
function bukaEksternal(url) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w) toast('Pop-up diblokir. Izinkan pop-up atau tekan tombol Buka di browser.');
}
document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => {
  switchTab(b.dataset.tab);
  // Google Sites menolak dibuka di dalam iframe, jadi halaman muka dibuka di browser (sekali per sesi)
  if (b.dataset.tab === 'tab4') {
    try { if (sessionStorage.getItem('homeOpened')) return; sessionStorage.setItem('homeOpened', '1'); } catch (e) {}
    bukaEksternal(DEFAULT_URL);
  }
}));

// ---------- Buka Link (mode desktop + zoom) ----------
const viewer = $('viewerTab4'), wrapper = $('desktop-wrapper');
let zoom = 1, pt = [];
function aturModeDesktop() {
  const w = wrapper.clientWidth, h = wrapper.clientHeight;
  if (!w) return;
  const scale = (w / 1024) * zoom;
  viewer.style.width = '1024px';
  viewer.style.height = (h / scale) + 'px';
  viewer.style.transform = `scale(${scale})`;
  viewer.style.transformOrigin = '0 0';
}
function ubahZoom(d) {
  zoom = Math.min(2, Math.max(0.5, +(zoom + d).toFixed(1)));
  $('zoom-text').textContent = Math.round(zoom * 100) + '%';
  aturModeDesktop();
}
function normalisasi(v) {
  v = v.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}
function mulaiLoading() {
  const c = $('progress'), b = $('progress-bar');
  pt.forEach(clearTimeout); c.style.display = 'block';
  b.style.transition = 'none'; b.style.width = '0%';
  pt = [setTimeout(() => { b.style.transition = 'width .5s'; b.style.width = '30%'; }, 50),
        setTimeout(() => { b.style.transition = 'width 2s'; b.style.width = '60%'; }, 600),
        setTimeout(() => { b.style.transition = 'width 5s'; b.style.width = '85%'; }, 2600)];
}
function selesaiLoading() {
  pt.forEach(clearTimeout);
  const b = $('progress-bar'); b.style.transition = 'width .3s'; b.style.width = '100%';
  setTimeout(() => { $('progress').style.display = 'none'; b.style.width = '0%'; }, 400);
}
function bukaLink() {
  const url = normalisasi($('linkInput').value);
  if (!url) return toast('Masukkan link terlebih dahulu');
  $('linkInput').value = url;
  $('empty-state').style.display = 'none';
  viewer.style.display = 'block';
  $('hint').style.display = 'flex';
  aturModeDesktop(); mulaiLoading();
  viewer.src = url;
}
viewer.addEventListener('load', () => { if (viewer.getAttribute('src')) selesaiLoading(); });
$('btnBuka').onclick = bukaLink;
$('btnDefault').onclick = () => bukaEksternal(DEFAULT_URL);
$('btnHint').onclick = () => bukaEksternal(normalisasi($('linkInput').value));
$('hintClose').onclick = () => { $('hint').style.display = 'none'; };
$('linkInput').addEventListener('keydown', e => { if (e.key === 'Enter') bukaLink(); });
$('btnReload').onclick = () => { const u = normalisasi($('linkInput').value); if (u) { mulaiLoading(); viewer.src = u; } else toast('Belum ada halaman dibuka'); };
$('btnExternal').onclick = () => { const u = normalisasi($('linkInput').value); u ? window.open(u, '_blank', 'noopener') : toast('Belum ada link'); };
$('zoomIn').onclick = () => ubahZoom(0.1);
$('zoomOut').onclick = () => ubahZoom(-0.1);
new ResizeObserver(aturModeDesktop).observe(wrapper);

// ---------- Scanner QR ----------
const video = $('video-scanner'), canvas = $('canvas-scanner'), ctx = canvas.getContext('2d', { willReadFrequently: true });
let stream = null, timer = null, detector = null;
if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {} }
const status = t => { $('scan-status').textContent = t; };

function bacaQR(src, w, h, max = 640) {
  if (typeof jsQR === 'undefined') return null;
  const s = Math.min(1, max / Math.max(w, h));
  canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
  return r ? r.data : null;
}
async function mulaiScan() {
  $('area-scanner').style.display = 'block';
  wrapper.style.display = 'none';
  if (!navigator.mediaDevices?.getUserMedia) return status('Kamera tidak tersedia. Gunakan tombol "Pilih foto QR".');
  status('Menyalakan kamera…');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = stream; await video.play();
    status('Arahkan kamera ke QR code');
    scanTick();
  } catch (e) {
    const pesan = { NotAllowedError: 'Izin kamera ditolak. Izinkan kamera lewat ikon di address bar, lalu coba lagi.',
      NotFoundError: 'Kamera tidak ditemukan. Gunakan tombol "Pilih foto QR".',
      NotReadableError: 'Kamera sedang dipakai aplikasi lain.' };
    status(pesan[e.name] || 'Kamera gagal dibuka (' + e.name + ').');
  }
}
async function scanTick() {
  if (!stream) return;
  if (video.readyState >= 2 && video.videoWidth) {
    let text = null;
    if (detector) {
      try {
        const c = await Promise.race([detector.detect(video), new Promise(r => setTimeout(() => r([]), 400))]);
        text = c[0]?.rawValue || null;
      } catch (e) { detector = null; }
    }
    if (!text) text = bacaQR(video, video.videoWidth, video.videoHeight);
    if (text) return berhasilScan(text);
  }
  timer = setTimeout(scanTick, 200);
}
function berhasilScan(text) {
  $('linkInput').value = text; tutupScan(); bukaLink();
}
function tutupScan() {
  clearTimeout(timer); timer = null;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  $('area-scanner').style.display = 'none';
  wrapper.style.display = 'block';
  aturModeDesktop();
}
$('btnScan').onclick = mulaiScan;
$('btnTutup').onclick = tutupScan;
$('btnFoto').onclick = () => $('qrFile').click();
$('qrFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const bmp = await createImageBitmap(f);
    const text = bacaQR(bmp, bmp.width, bmp.height, 1200);
    text ? berhasilScan(text) : status('QR tidak terbaca di foto ini. Coba foto yang lebih jelas.');
  } catch (err) { status('Foto tidak bisa dibaca.'); }
};

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.error('SW gagal:', err)));
}

// ---------- Mulai ----------
let last = 'tab1'; try { last = localStorage.getItem('lastTab') || 'tab1'; } catch (e) {}
switchTab(last);
