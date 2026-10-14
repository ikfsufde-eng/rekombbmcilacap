const $ = id => document.getElementById(id);

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
  if (tabId === 'tab4') setTimeout(aturModeDesktop, 30);
  else tutupScan();
  try { localStorage.setItem('lastTab', tabId); } catch (e) {}
}
document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
let last = 'tab1'; try { last = localStorage.getItem('lastTab') || 'tab1'; } catch (e) {}
switchTab(last);

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
  aturModeDesktop(); mulaiLoading();
  viewer.src = url;
}
viewer.addEventListener('load', () => { if (viewer.getAttribute('src')) selesaiLoading(); });
$('btnBuka').onclick = bukaLink;
$('linkInput').addEventListener('keydown', e => { if (e.key === 'Enter') bukaLink(); });
$('btnReload').onclick = () => { const u = normalisasi($('linkInput').value); if (u) { mulaiLoading(); viewer.src = u; } else toast('Belum ada halaman dibuka'); };
$('btnExternal').onclick = () => { const u = normalisasi($('linkInput').value); u ? window.open(u, '_blank', 'noopener') : toast('Belum ada link'); };
$('zoomIn').onclick = () => ubahZoom(0.1);
$('zoomOut').onclick = () => ubahZoom(-0.1);
new ResizeObserver(aturModeDesktop).observe(wrapper);

// ---------- Scanner QR ----------
const video = $('video-scanner'), canvas = $('canvas-scanner'), ctx = canvas.getContext('2d', { willReadFrequently: true });
let stream = null, raf = null, busy = false, detector = null;
if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {} }

async function mulaiScan() {
  if (!navigator.mediaDevices?.getUserMedia) return toast('Browser tidak mendukung kamera');
  $('area-scanner').style.display = 'block';
  wrapper.style.display = 'none';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream; await video.play();
    raf = requestAnimationFrame(scanLoop);
  } catch (e) {
    toast('Kamera tidak bisa diakses. Izinkan akses kamera di pengaturan browser.');
    tutupScan();
  }
}
async function scanLoop() {
  if (!stream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA && !busy) {
    busy = true;
    try {
      let text = null;
      if (detector) {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) text = codes[0].rawValue;
      } else if (typeof jsQR !== 'undefined') {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (r?.data) text = r.data;
      }
      if (text) { busy = false; return berhasilScan(text); }
    } catch (e) {}
    busy = false;
  }
  raf = requestAnimationFrame(scanLoop);
}
function berhasilScan(text) {
  $('linkInput').value = text; tutupScan(); bukaLink();
}
function tutupScan() {
  if (raf) cancelAnimationFrame(raf); raf = null;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  $('area-scanner').style.display = 'none';
  wrapper.style.display = 'block';
  aturModeDesktop();
}
$('btnScan').onclick = mulaiScan;
$('btnTutup').onclick = tutupScan;

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.error('SW gagal:', err)));
}
