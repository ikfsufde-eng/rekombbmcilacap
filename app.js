const $ = id => document.getElementById(id);
const DEFAULT_URL = 'https://sites.google.com/view/rekombbmcilacap/halaman-muka';

// PIN Admin untuk menambah/mengatur pengumuman notifikasi dari dalam aplikasi
const ADMIN_PIN = '123456';

// Opsional: Jika Anda punya URL Google Apps Script default untuk penarikan notifikasi otomatis, isi di sini:
const DEFAULT_NOTIF_API_URL = 'https://script.google.com/macros/s/AKfycbw5UVQQShzuuWx9S8kg9M8UAoM6duJRQ9LJkR5M6A8VLhVxOuuIOYhh6bzBDI8WNeu4IA/exec';


// ═══════════════════════════════════════════
//  TOAST & AUDIO FEEDBACK
// ═══════════════════════════════════════════
let toastT;
let isSoundOn = true;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3200);
}

function playBeep(freq = 880, duration = 120) {
  if (!isSoundOn) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctxAudio = new AudioCtx();
    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctxAudio.currentTime);
    gain.gain.setValueAtTime(0.15, ctxAudio.currentTime);
    osc.connect(gain);
    gain.connect(ctxAudio.destination);
    osc.start();
    osc.stop(ctxAudio.currentTime + duration / 1000);
  } catch (e) {}
}

// ═══════════════════════════════════════════
//  JAM REALTIME & INDIKATOR KONEKSI
// ═══════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if ($('live-clock'))$('live-clock').textContent = timeStr + ' WIB';
}
setInterval(updateClock, 1000);
updateClock();

let netState = null;
function setNet(state) { // 'online' | 'slow' | 'offline'
  const badge = $('net-badge'); if (!badge) return;
  const L = { online: 'Online', slow: 'Koneksi Lambat', offline: 'Tidak Konek' };
  badge.className = 'status-pill ' + state;
  badge.innerHTML = '<span class="dot"></span>' + L[state];
  let bar = $('net-banner');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'net-banner'; bar.hidden = true;
    bar.textContent = '⚠️ Tidak ada koneksi internet. Cek Status, Live Meet, FAQ terbaru, dan kirim WA tidak dapat dipakai sampai tersambung kembali.';
    const hd = document.querySelector('.app-header'); if (hd) hd.after(bar);
  }
  bar.hidden = state !== 'offline';
  if (netState !== null && netState !== state) {
    if (state === 'offline') toast('🔴 Tidak konek ke internet');
    else if (state === 'slow') toast('🟠 Koneksi lambat');
    else toast('✅ Kembali terhubung ke internet');
  }
  netState = state;
}
// Cek koneksi NYATA (navigator.onLine saja tidak cukup: WiFi tersambung tapi tanpa internet tetap dianggap online)
async function updateNetStatus() {
  if (!navigator.onLine) return setNet('offline');
  const t0 = performance.now(), c = new AbortController(), to = setTimeout(() => c.abort(), 6000);
  try {
    await fetch('https://www.gstatic.com/generate_204', { mode: 'no-cors', cache: 'no-store', signal: c.signal });
    clearTimeout(to); setNet(performance.now() - t0 > 3000 ? 'slow' : 'online');
  } catch (e) { clearTimeout(to); setNet('offline'); }
}
window.addEventListener('online', updateNetStatus);
window.addEventListener('offline', () => setNet('offline'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateNetStatus(); });
setInterval(updateNetStatus, 15000);
updateNetStatus();

// ═══════════════════════════════════════════
//  NAVIGASI TAB PANEL
// ═══════════════════════════════════════════
function loadPanel(panel) {
  const f = panel.querySelector('iframe[data-src]');
  if (!f) return;
  f.addEventListener('load', () => panel.querySelector('.loader')?.classList.add('done'), { once: true });
  f.src = f.dataset.src;
  f.removeAttribute('data-src');
  setTimeout(() => panel.querySelector('.loader')?.classList.add('done'), 15000);
}

function switchTab(tabId) {
  const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (!btn) return;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const panel = $(tabId);
  panel.classList.add('active');
  btn.classList.add('active');
  $('app-title').textContent = btn.dataset.title;
  loadPanel(panel);

  if (tabId === 'tab4') {
    setTimeout(aturModeDesktop, 30);
    if (!$('linkInput').value) {$('linkInput').value = DEFAULT_URL;
      toggleClearBtn();
    }
  } else {
    stopCamera();
  }
  try { localStorage.setItem('lastTab', tabId); } catch (e) {}
}

function bukaEksternal(url) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w) toast('Pop-up diblokir. Izinkan pop-up atau tekan tombol Browser.');
}

document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => {
  switchTab(b.dataset.tab);
  if (b.dataset.tab === 'tab4') {
    try {
      if (sessionStorage.getItem('homeOpened')) return;
      sessionStorage.setItem('homeOpened', '1');
    } catch (e) {}
    bukaEksternal(DEFAULT_URL);
  }
}));

if ($('btnEmptyScan')) $('btnEmptyScan').onclick = () => mulaiScan();

// ═══════════════════════════════════════════
//  TAB 4: BUKA LINK APA ADANYA (TANPA KONVERSI)
// ═══════════════════════════════════════════
const viewer = $('viewerTab4'), wrapper =$('desktop-wrapper');
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

function toggleClearBtn() {
  $('btnClearInput').style.display =$('linkInput').value ? 'block' : 'none';
}
$('linkInput').addEventListener('input', toggleClearBtn);
$('btnClearInput').onclick = () => {$('linkInput').value = '';
  toggleClearBtn();
  $('linkInput').focus();
};

function mulaiLoading() {
  const c = $('progress'), b =$('progress-bar');
  pt.forEach(clearTimeout);
  c.style.display = 'block';
  b.style.transition = 'none';
  b.style.width = '0%';
  pt = [
    setTimeout(() => { b.style.transition = 'width .5s'; b.style.width = '35%'; }, 50),
    setTimeout(() => { b.style.transition = 'width 2s'; b.style.width = '65%'; }, 600),
    setTimeout(() => { b.style.transition = 'width 5s'; b.style.width = '88%'; }, 2600)
  ];
}

function selesaiLoading() {
  pt.forEach(clearTimeout);
  const b = $('progress-bar');
  b.style.transition = 'width .3s';
  b.style.width = '100%';
  setTimeout(() => { $('progress').style.display = 'none'; b.style.width = '0%'; }, 400);
}

// Buka Link Apa Adanya tanpa memodifikasi URL script
function bukaLink() {
  const raw = $('linkInput').value.trim();
  if (!raw) return toast('Masukkan link atau scan QR terlebih dahulu');

  toggleClearBtn();
  saveHistory(raw);

  $('empty-state').style.display = 'none';
  viewer.style.display = 'block';
  $('hint').style.display = 'flex';
  aturModeDesktop();
  mulaiLoading();
  viewer.src = raw;
}

viewer.addEventListener('load', () => { if (viewer.getAttribute('src')) selesaiLoading(); });
$('btnBuka').onclick = bukaLink;
$('btnDefault').onclick = () => bukaEksternal(DEFAULT_URL);
$('btnHint').onclick = () => bukaEksternal($('linkInput').value.trim());
$('hintClose').onclick = () => {$('hint').style.display = 'none'; };
$('linkInput').addEventListener('keydown', e => { if (e.key === 'Enter') bukaLink(); });$('btnReload').onclick = () => {
  const u = $('linkInput').value.trim();
  if (u) { mulaiLoading(); viewer.src = u; } else toast('Belum ada halaman dibuka');
};
$('btnExternal').onclick = () => {
  const u = $('linkInput').value.trim();
  u ? window.open(u, '_blank', 'noopener') : toast('Belum ada link');
};
$('zoomIn').onclick = () => ubahZoom(0.1);$('zoomOut').onclick = () => ubahZoom(-0.1);
new ResizeObserver(aturModeDesktop).observe(wrapper);

// ── RIWAYAT SCAN & LINK ──
const HIST_KEY = 'fuelstar_scan_history';
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; }
}
function saveHistory(url) {
  let list = getHistory().filter(x => x.url !== url);
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  list.unshift({ url, time });
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 8))); } catch (e) {}
  renderHistory();
}
function renderHistory() {
  const list = getHistory();
  const el = $('history-list');
  if (!list.length) {
    el.innerHTML = '<div style="font-size:0.75rem;color:#94a3b8;text-align:center;padding:8px;">Belum ada riwayat tautan/scan.</div>';
    return;
  }
  el.innerHTML = list.map(item => `
    <div class="history-item" data-url="${item.url.replace(/"/g, '&quot;')}">
      <span class="history-item-url">${item.url}</span>
      <span class="history-item-time">${item.time}</span>
    </div>
  `).join('');
  el.querySelectorAll('.history-item').forEach(row => {
    row.onclick = () => {
      $('linkInput').value = row.dataset.url;
      toggleClearBtn();
      $('history-bar').hidden = true;
      bukaLink();
    };
  });
}
$('btnHistoryToggle').onclick = () => {
  const bar = $('history-bar');
  bar.hidden = !bar.hidden;
  if (!bar.hidden) renderHistory();
};
$('btnClearHistory').onclick = () => {
  localStorage.removeItem(HIST_KEY);
  renderHistory();
  toast('Riwayat dihapus');
};

// ═══════════════════════════════════════════
//  QR9 SCANNER ENGINE (MURNI TANPA DECODE)
// ═══════════════════════════════════════════
const video = $('video-scanner');
const canvas = $('canvas-scanner');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let stream = null;
let rafId = null;
let isProcessing = false;
let cooldownUntil = 0;
let lastScanTime = 0;
const SCAN_INTERVAL = 150;
let missStreak = 0;
let scanning = false;
let lastScannedID = '';
let lastScannedTime = 0;

let barcodeDetector = null;
let jsQRLib = window.jsQR || null;

function initDetector() {
  if ('BarcodeDetector' in window) {
    try {
      barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {}
  }
  if (!window.jsQR) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = () => { jsQRLib = window.jsQR; };
    document.head.appendChild(s);
  }
}
initDetector();

function setScanResult(text, cls = 'info') {
  const el = $('scan-status');
  el.className = 'scan-result-box ' + cls;
  el.textContent = text;
}

function setScanDot(state) {
  const d = $('scan-dot');
  d.className = 'pulse-dot' + (state ? ' ' + state : '');
}

function showPerm(show) {
  $('perm-overlay').style.display = show ? 'flex' : 'none';
}

$('btn-sound-mode').onclick = function() {
  isSoundOn = !isSoundOn;
  this.textContent = isSoundOn ? '🔊 Suara: ON' : '🔇 Suara: OFF';
  this.classList.toggle('on', isSoundOn);
};

function mulaiScan() {
  $('area-scanner').style.display = 'block';
  wrapper.style.display = 'none';
  startCamera();
}

function startCamera() {
  stopCamera(true);
  showPerm(false);
  setScanDot('');
  $('scan-title-status').textContent = 'Menghubungkan Kamera…';
  setScanResult('📷 Meminta izin kamera…', 'info');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setScanResult('❌ Browser tidak mendukung kamera. Gunakan Pilih Gambar QR.', 'err');
    setScanDot('err');
    return;
  }

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  })
  .then(s => {
    stream = s;
    video.srcObject = s;
    try {
      const track = s.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.focusMode && caps.focusMode.indexOf('continuous') !== -1) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
    } catch (e) {}

    video.onloadedmetadata = () => {
      video.play();
      setScanDot('on');
      $('scan-title-status').textContent = 'Kamera Siap Memindai';
      setScanResult('📷 Kamera siap. Arahkan ke QR Code.', 'info');
      scanLoop();
    };
  })
  .catch(err => {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      showPerm(true);
      setScanResult('🚫 Akses kamera diblokir. Ikuti petunjuk di atas.', 'err');
    } else if (err.name === 'NotFoundError') {
      setScanResult('❌ Tidak ditemukan kamera di perangkat ini.', 'err');
    } else if (err.name === 'NotReadableError') {
      setScanResult('⚠️ Kamera sedang dipakai aplikasi lain.', 'err');
    } else if (err.name === 'OverconstrainedError') {
      fallbackCamera();
      return;
    } else {
      setScanResult('⚠️ Gagal akses kamera: ' + err.name, 'err');
    }
    setScanDot('err');
    $('scan-title-status').textContent = 'Kamera Bermasalah';
  });
}

function fallbackCamera() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(s => {
    stream = s;
    video.srcObject = s;
    video.onloadedmetadata = () => {
      video.play();
      setScanDot('on');
      $('scan-title-status').textContent = 'Kamera Aktif (Fallback)';
      setScanResult('📷 Kamera siap (mode kompatibilitas).', 'info');
      scanLoop();
    };
  })
  .catch(err => {
    setScanResult('❌ Tidak bisa mengakses kamera: ' + err.message, 'err');
    setScanDot('err');
  });
}

function stopCamera(keepUI = false) {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
  if (!keepUI) {
    $('area-scanner').style.display = 'none';
    wrapper.style.display = 'block';
    aturModeDesktop();
  }
}

function scanLoop() {
  rafId = requestAnimationFrame(() => {
    const now = Date.now();
    if (!isProcessing && !scanning && now >= cooldownUntil && now - lastScanTime >= SCAN_INTERVAL) {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        lastScanTime = now;

        if (barcodeDetector) {
          scanning = true;
          barcodeDetector.detect(video)
            .then(codes => {
              scanning = false;
              if (codes && codes.length > 0 && codes[0].rawValue) {
                missStreak = 0;
                handleScan(codes[0].rawValue);
              } else {
                missStreak++;
              }
            })
            .catch(() => { scanning = false; missStreak++; });

        } else if (jsQRLib || window.jsQR) {
          const lib = jsQRLib || window.jsQR;
          const vw = video.videoWidth, vh = video.videoHeight;
          if (!vw || !vh) { scanLoop(); return; }
          const displayW = video.offsetWidth || vw;
          const displayH = video.offsetHeight || vh;
          const scale = Math.max(vw / displayW, vh / displayH);
          const vfSize = Math.min(240, displayW * 0.66);
          let cropSize = Math.round(vfSize * scale);
          const cropX = Math.max(0, Math.round((vw - cropSize) / 2));
          const cropY = Math.max(0, Math.round((vh - cropSize) / 2));
          cropSize = Math.min(cropSize, vw - cropX, vh - cropY);
          let cs = missStreak < 20 ? 320 : 480;
          cs = Math.min(cs, cropSize);
          if (canvas.width !== cs || canvas.height !== cs) { canvas.width = cs; canvas.height = cs; }
          ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cs, cs);
          const imageData = ctx.getImageData(0, 0, cs, cs);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            const g = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
            const v = g < 128 ? (g > 40 ? g - 40 : 0) : (g < 215 ? g + 40 : 255);
            d[i] = d[i + 1] = d[i + 2] = v;
          }
          const code = lib(d, cs, cs, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) {
            missStreak = 0;
            handleScan(code.data);
          } else {
            missStreak++;
          }
        }
      }
    }
    scanLoop();
  });
}

// Munculkan dan buka hasil scan apa adanya tanpa konversi
function handleScan(decodedText) {
  const rawText = String(decodedText).trim();
  if (!rawText) return;

  if (rawText === lastScannedID && (Date.now() - lastScannedTime < 3500)) return;
  lastScannedID = rawText;
  lastScannedTime = Date.now();

  playBeep(920, 130);
  if (navigator.vibrate) navigator.vibrate(100);

  setScanResult('✅ Hasil Scan: ' + rawText, 'ok');
  $('linkInput').value = rawText;
  toggleClearBtn();

  setTimeout(() => {
    stopCamera(false);
    bukaLink();
  }, 400);
}

// Scan dari File Gambar
$('btnFoto').onclick = () => $('qrFile').click();$('qrFile').onchange = function(e) {
  if (!e.target.files || !e.target.files.length) return;
  const file = e.target.files[0];
  const reader = new FileReader();
  setScanResult('⏳ Membaca gambar QR…', 'loading');
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const tc = document.createElement('canvas');
      const tx = tc.getContext('2d');
      tc.width = img.width;
      tc.height = img.height;
      tx.drawImage(img, 0, 0);
      const imageData = tx.getImageData(0, 0, img.width, img.height);
      const lib = jsQRLib || window.jsQR;
      if (!lib) {
        setScanResult('❌ Library jsQR belum siap, coba lagi.', 'err');
        return;
      }
      const code = lib(imageData.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) {
        handleScan(code.data);
      } else {
        setScanResult('❌ QR Code tidak ditemukan pada gambar.', 'err');
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};

$('btnScan').onclick = mulaiScan;
$('btnTutup').onclick = () => stopCamera(false);
$('btnRestartCam').onclick = () => { lastScannedID = ''; isProcessing = false; cooldownUntil = 0; missStreak = 0; scanning = false; startCamera(); };$('btn-allow').onclick = () => { showPerm(false); startCamera(); };

// ═══════════════════════════════════════════
//  PUSAT NOTIFIKASI & PANEL PENGATURAN ADMIN
// ═══════════════════════════════════════════
const NOTIF_KEY = 'fuelstar_notifications_v2';
const NOTIF_API_KEY = 'fuelstar_notif_api_url';
let isAdminUnlocked = false;

const defaultNotifs = [
  {
    id: 'n1',
    title: 'Selamat Datang di Fuel Star W.A',
    body: 'Gunakan tombol Pengajuan di tengah bawah untuk mengajukan rekomendasi baru, atau Cek Status untuk memantau proses.',
    time: 'Info Layanan',
    unread: true,
    icon: 'verified'
  },
  {
    id: 'n2',
    title: 'Jam Operasional Pelayanan',
    body: 'Pelayanan verifikasi & penerbitan rekomendasi BBM Dinas Perikanan Kab. Cilacap buka sesuai jam kerja kedinasan.',
    time: 'Pengumuman',
    unread: true,
    icon: 'schedule'
  }
];

function getNotifs() {
  try {
    const saved = localStorage.getItem(NOTIF_KEY);
    return saved ? JSON.parse(saved) : defaultNotifs;
  } catch (e) {
    return defaultNotifs;
  }
}

function saveNotifs(list) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {}
  renderNotifs();
}

function renderNotifs() {
  const list = getNotifs();
  const unreadCount = list.filter(n => n.unread).length;
  const badge = $('notif-badge');
  badge.textContent = unreadCount;
  badge.classList.toggle('hidden', unreadCount === 0);

  if (!list.length) {
    $('notif-list').innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:0.8rem;padding:24px;">Belum ada pengumuman.</div>';
    return;
  }

  $('notif-list').innerHTML = list.map(n => `
    <div class="notif-card ${n.unread ? 'unread' : ''}" data-id="${n.id}">
      <div class="notif-icon"><i class="material-icons-round">${n.icon || 'campaign'}</i></div>
      <div class="notif-body">
        <h4>${n.title}</h4>
        <p>${n.body}</p>
        <span class="notif-time">${n.time}</span>
      </div>
      <button class="notif-del-btn" data-del="${n.id}" title="Hapus Permanen"><i class="material-icons-round" style="font-size:18px;">delete</i></button>
    </div>
  `).join('');

  $('notif-list').querySelectorAll('.notif-del-btn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.dataset.del;
      saveNotifs(getNotifs().filter(x => x.id !== id));
      
      // Simpan ID ke daftar blokir agar tidak ditarik lagi dari server
      const blockList = JSON.parse(localStorage.getItem('fuelstar_notif_blocked') || '[]');
      if (!blockList.includes(id)) {
        blockList.push(id);
        localStorage.setItem('fuelstar_notif_blocked', JSON.stringify(blockList));
      }
      
      toast('Pengumuman dihapus permanen');
    };
  });
}

function addAppNotification(title, body, icon = 'campaign', customId = null, customTime = null) {
  const list = getNotifs();
  const id = customId || ('n_' + Date.now());
  
  const blockList = JSON.parse(localStorage.getItem('fuelstar_notif_blocked') || '[]');
  if (blockList.includes(id)) return; // Tolak jika ID sudah dihapus permanen oleh pengguna

  if (list.some(x => x.id === id)) return; // Hindari duplikat jika sinkron dari server

  const time = customTime || (new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' · ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');
  list.unshift({ id, title, body, time, unread: true, icon });
  saveNotifs(list);
  playBeep(740, 100);
  sendBrowserPush(title, body);
}

// Tarik Pengumuman dari URL Google Apps Script Admin (Jika dikonfigurasi)
async function syncRemoteNotifications(showFeedback = false) {
  const apiUrl = localStorage.getItem(NOTIF_API_KEY) || DEFAULT_NOTIF_API_URL;
  if (!apiUrl) {
    if (showFeedback) toast('ℹ️ Belum ada URL Server Notifikasi yang diatur di menu Admin.');
    return;
  }
  if (showFeedback) toast('⏳ Menarik info terbaru dari server…');
  try {
    const url = apiUrl + (apiUrl.includes('?') ? '&' : '?') + 'action=get_notifs&t=' + Date.now();
    const res = await fetch(url, { redirect: 'follow' });
    const data = await res.json();
    if (Array.isArray(data.notifications)) {
      let added = 0;
      let current = getNotifs();
      const blockList = JSON.parse(localStorage.getItem('fuelstar_notif_blocked') || '[]');

      // Sinkronisasi Penghapusan: Hapus notifikasi di HP yang sudah tidak ada di server database (kecuali default n1 & n2)
      const serverIds = data.notifications.map(n => String(n.id));
      const filteredCurrent = current.filter(n => serverIds.includes(n.id) || n.id === 'n1' || n.id === 'n2');
      if (current.length !== filteredCurrent.length) {
        saveNotifs(filteredCurrent);
        current = filteredCurrent; // Perbarui state variabel lokal
      }

      data.notifications.forEach(item => {
        const strId = String(item.id);
        if (item.id && !current.some(x => x.id === strId) && !blockList.includes(strId)) {
          addAppNotification(item.title, item.body, item.icon || 'campaign', strId, item.time);
          added++;
        }
      });
      if (showFeedback) toast(added > 0 ? `✅ ${added} pengumuman baru diterima!` : '✅ Info sudah paling baru.');
    }
  } catch (err) {
    if (showFeedback) toast('⚠️ Gagal menarik notifikasi dari server.');
  }
}

function sendBrowserPush(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          vibrate: [150, 80, 150]
        });
      });
    } else {
      new Notification(title, { body, icon: 'icon-192.png' });
    }
  } catch (e) {}
}

function checkPushBanner() {
  if (!('Notification' in window) || Notification.permission === 'granted') {
    $('push-banner').style.display = 'none';
  }
}

$('btnNotif').onclick = () => {
  $('notif-drawer').classList.add('open');$('notif-backdrop').hidden = false;
  checkPushBanner();
};
function closeNotifDrawer() {
  $('notif-drawer').classList.remove('open');$('notif-backdrop').hidden = true;
}
$('btnCloseNotif').onclick = closeNotifDrawer;
$('notif-backdrop').onclick = closeNotifDrawer;

$('btnMarkAllRead').onclick = () => {
  const list = getNotifs().map(n => ({ ...n, unread: false }));
  saveNotifs(list);
  toast('Semua pesan ditandai sudah dibaca');
};

$('btnSyncNotif').onclick = () => syncRemoteNotifications(true);

// ── LOGIKA PANEL ADMIN NOTIFIKASI ──
$('btnToggleAdmin').onclick = () => {
  const panel = $('admin-notif-panel');
  panel.hidden = !panel.hidden;
  $('adm-api-url').value = localStorage.getItem(NOTIF_API_KEY) || DEFAULT_NOTIF_API_URL;
};

$('btnAdminLogin').onclick = () => {
  const pin = $('admin-pin-input').value.trim();
  if (pin === ADMIN_PIN) {
    isAdminUnlocked = true;
    $('admin-login-box').hidden = true;
    $('admin-form-box').hidden = false;
    $('admin-pin-input').value = '';
    renderNotifs();
    toast('🔓 Mode Admin Aktif');
  } else {
    toast('❌ PIN Admin salah!');
  }
};

$('btnAdminLogout').onclick = () => {
  isAdminUnlocked = false;
  $('admin-login-box').hidden = false;
  $('admin-form-box').hidden = true;
  $('admin-notif-panel').hidden = true;
  renderNotifs();
  toast('🔒 Mode Admin Dikunci');
};

$('btnAdminPublish').onclick = async () => {
  const title = $('adm-title').value.trim();
  const body = $('adm-body').value.trim();
  const icon = $('adm-icon').value;
  const apiUrl = localStorage.getItem(NOTIF_API_KEY) || DEFAULT_NOTIF_API_URL;

  if (!title || !body) return toast('⚠️ Judul dan isi pengumuman wajib diisi!');
  if (!apiUrl) return toast('⚠️ URL API belum diisi di setelan bawah!');

  toast('⏳ Mengirim pengumuman ke Google Spreadsheet…');

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'add_notif', title, body, icon })
    });
    
    const result = await res.json();
    if (result && result.status === 'success') {
      // Simpan lokal setelah server sukses mencatat
      addAppNotification(title, body, icon, result.id);
      $('adm-title').value = '';
      $('adm-body').value = '';
      toast('📢 Pengumuman berhasil masuk ke Spreadsheet & terbit!');
    } else {
      toast('❌ Gagal simpan ke server: ' + (result.message || 'Respons tidak valid'));
    }
  } catch (err) {
    console.error(err);
    toast('❌ Gagal menghubungi Google Sheet. Periksa koneksi atau Deployment Web App Anda.');
  }
};

$('btnSaveApiUrl').onclick = () => {
  const val = $('adm-api-url').value.trim();
  localStorage.setItem(NOTIF_API_KEY, val);
  toast('✅ URL API Notifikasi disimpan');
  if (val) syncRemoteNotifications(true);
};

$('btnEnablePush').onclick = async () => {
  if (!('Notification' in window)) return toast('Browser ini tidak mendukung Push Notification');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    $('push-banner').style.display = 'none';
    toast('✅ Notifikasi Layar berhasil diaktifkan!');
    sendBrowserPush('Fuel Star W.A Aktif', 'Anda akan menerima notifikasi layanan secara langsung.');
  } else {
    toast('⚠️ Izin notifikasi belum diberikan');
  }
};

renderNotifs();
setTimeout(() => syncRemoteNotifications(false), 3000);

// ═══════════════════════════════════════════
//  SERVICE WORKER & INIT
// ═══════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(reg => { try { reg.update(); } catch (e) {} })
      .catch(err => console.error('SW gagal:', err));
  });
}

let last = 'tab1';
try { last = localStorage.getItem('lastTab') || 'tab1'; } catch (e) {}
switchTab(last);


// ═══════════════════════════════════════════
//  FORM PENGAJUAN BBM (SAMA PLEK TEMPLATE) & SINKRONISASI TAB 2
// ═══════════════════════════════════════════
let currentBBM = 'pertalite';
let formIsValid = true;
const TAB2_BASE_URL = 'https://script.google.com/macros/s/AKfycbyc5Xx7UWE0MmXGXQjNST2aHKQQo1H46LeZRUmb45pm7HU6JrvbGUKs3XhSaIJf5AG3/exec';

function switchBBM(type) {
  currentBBM = type;
  $('tab-pertalite').classList.toggle('active', type === 'pertalite');$('tab-solar').classList.toggle('active', type === 'solar');

  document.querySelectorAll('.pertalite-only').forEach(el => el.style.display = type === 'pertalite' ? 'block' : 'none');
  document.querySelectorAll('.solar-only').forEach(el => el.style.display = type === 'solar' ? 'block' : 'none');

  if (type === 'pertalite') {
    $('form-subtitle').textContent = 'ISIIkan5 form permohonan rekom bbm berikut (ganti tanda xxx dengan data anda) :';$('lbl_nik').innerHTML = '2. *NIK Pemilik (pastikan ditulis sesuai KTP) : <span id="err_nik" class="err-msg"></span>';
    $('lbl_kapal').textContent = '4. *Nama Kapal (tulis nama kapalnya saja sesuai yang tertulis pada pas kecil) :';$('lbl_wa').innerHTML = '5. *No Whatsapp aktif pemilik : <span id="err_wa" class="err-msg"></span>';
    $('lbl_mesin').innerHTML = '6. *Daya Mesin Kapal (sesuai pas kecil, tulis nilainya saja, Contoh penulisan. 5.5 ) : <span id="err_mesin" class="err-msg"></span>';
    $('f_mesin').placeholder = 'Contoh penulisan: 5.5';$('lbl_volume').innerHTML = '8. *Volume Permohonan perbulan (dalam satuan Liter, tulis nilainya saja, Contoh penulisan 600 ) : <span id="err_volume" class="err-msg"></span>';
    $('f_volume').placeholder = 'Contoh penulisan: 600';$('lbl_gt').innerHTML = '9. *Tonase Kapal GT Kapal (sesuai pas kecil, Contoh penulisan. 1) : <span id="err_gt" class="err-msg"></span>';
    $('f_gt').placeholder = 'Contoh penulisan: 1';$('lbl_hari').innerHTML = '12. *Rencana Lama Hari Operasi 1 bulan : <span id="err_lama_hari" class="err-msg"></span>';
  } else {
    $('form-subtitle').textContent = 'ISIIIkan6 form permohonan rekom bbm berikut:';$('lbl_nik').innerHTML = '2. *NIK Pemilik (pastikan ditulis sesuai ktp) : <span id="err_nik" class="err-msg"></span>';
    $('lbl_kapal').textContent = '4. *Nama Kapal (tulis nama kapalnya saja sesuai yang tertulis pada pas besar) :';$('lbl_wa').innerHTML = '5. *Nomor Whatsapp aktif : <span id="err_wa" class="err-msg"></span>';
    $('lbl_mesin').innerHTML = '6. *Daya Mesin Kapal (sesuai pas besar, tulis nilainya saja, Contoh penulisan. 180) : <span id="err_mesin" class="err-msg"></span>';
    $('f_mesin').placeholder = 'Contoh penulisan: 180';$('lbl_volume').innerHTML = '8. *Volume Permohonan (dalam satuan Liter, tulis nilainya saja, Contoh penulisan. 12000 ) : <span id="err_volume" class="err-msg"></span>';
    $('f_volume').placeholder = 'Contoh penulisan: 12000';$('lbl_gt').innerHTML = '9. *Tonase Kapal GT Kapal (sesuai pas besar, Contoh. 29) : <span id="err_gt" class="err-msg"></span>';
    $('f_gt').placeholder = 'Contoh: 29';$('lbl_hari').innerHTML = '12. *Rencana Lama Hari Operasi dalam 1 Trip : <span id="err_lama_hari" class="err-msg"></span>';
  }

  cekValidasi();
  generatePreview();
}

function cekValidasi() {
  formIsValid = true;
  const setError = (id, msg) => {
    const el = $(id);
    if (el) el.classList.add('input-error');
    const errSpan = $('err_' + id.replace('f_', ''));
    if (errSpan) { errSpan.textContent = msg; errSpan.style.display = 'inline'; }
    formIsValid = false;
  };
  const clearError = (id) => {
    const el = $(id);
    if (el) el.classList.remove('input-error');
    const errSpan = $('err_' + id.replace('f_', ''));
    if (errSpan) errSpan.style.display = 'none';
  };

  // 1. Validasi NIK 16 Digit
  const nik = $('f_nik').value.trim();
  if (nik && nik.length !== 16) setError('f_nik', '(Wajib 16 Digit!)');
  else clearError('f_nik');

  // 2. Validasi Jam Operasi Maksimal 16 Jam
  const jamRaw = $('f_lama_jam').value.trim();
  const jam = Number(jamRaw);
  if (jamRaw && (jam > 16 || jam < 1)) setError('f_lama_jam', '(Maksimal 16 jam/hari!)');
  else clearError('f_lama_jam');

  // 3. Validasi BKP Solar Wajib 5 Digit
  if (currentBBM === 'solar') {
    const bkp = $('f_bkp').value.trim();
    if (bkp && bkp.length !== 5) setError('f_bkp', '(Wajib 5 digit terakhir!)');
    else clearError('f_bkp');
  }

  return formIsValid;
}

function generatePreview() {
  const valOr = (id, fallback) => {
    const el = $(id);
    return (el && el.value.trim() !== '') ? el.value.trim() : fallback;
  };

  let text = '';
  if (currentBBM === 'pertalite') {
    text = `ISIIkan5 form permohonan rekom bbm berikut (ganti tanda xxx dengan data anda) :

1. *Nama Pemilik (diisi sesuai KTP) : ${valOr('f_nama', 'xxx')}
2. *NIK Pemilik (ditulis sesuai KTP) : ${valOr('f_nik', 'xxx')}
3. *Lama waktu operasi mesin dalam sehari (dalam satuan jam/hari, tulis nilainya, max 16 jam sehari, Contoh. 16) : ${valOr('f_lama_jam', 'xxx')}
4. *Nama Kapal (tulis nama kapalnya saja sesuai yang tertulis pada pas kecil) : ${valOr('f_kapal', 'xxx')}
5. *No Whatsapp aktif pemilik : ${valOr('f_wa', 'xxx')}
6. *Daya Mesin Kapal (sesuai pas kecil, tulis nilainya saja, Contoh penulisan. 5.5 ) : ${valOr('f_mesin', 'xxx')}
7. *Alamat Pemilik : ${valOr('f_alamat', 'Ds/Kel xxx , Kec xxx , Cilacap')}
8. *Volume Permohonan perbulan (dalam satuan Liter, tulis nilainya saja, Contoh penulisan 600 ) : ${valOr('f_volume', 'xxx')}
9. *Tonase Kapal GT Kapal (sesuai pas kecil, Contoh penulisan. 1) : ${valOr('f_gt', 'xxx')}
10. *Tujuan pengisian pertalite (tulis nomor spbu nya, Contoh 4453201) : ${valOr('f_tujuan_p', 'xxx')}
11. *Nomor registrasi kapal Tanda selar (sesuai pas kecil) : JTA no ${valOr('f_selar', 'xxx')}
12. *Rencana Lama Hari Operasi 1 bulan : ${valOr('f_lama_hari', 'xxx')} 
13. *Tanggl : ${valOr('f_jenis_p', 'BARU')}`;
  } else {
    text = `ISIIIkan6 form permohonan rekom bbm berikut:

1. *Nama Pemilik (diisi sesuai KTP) : ${valOr('f_nama', 'xxx')}
2. *NIK Pemilik (pastikan ditulis sesuai ktp) : ${valOr('f_nik', 'xxx')}
3. *Lama waktu operasi mesin dalam sehari (dalam satuan jam/hari, tulis nilainya, max 16 jam sehari, Contoh. 16) : ${valOr('f_lama_jam', '00')}
4. *Nama Kapal (tulis nama kapalnya saja sesuai yang tertulis pada pas besar) : ${valOr('f_kapal', 'xxx')}
5. *Nomor Whatsapp aktif : ${valOr('f_wa', 'xxx')}
6. *Daya Mesin Kapal (sesuai pas besar, tulis nilainya saja, Contoh penulisan. 180) : ${valOr('f_mesin', 'xxx')}
7. *Sisa Solar (dalam satuan Liter, tulis nilainya saja, Contoh penulisan. 500) : ${valOr('f_sisa_solar', '00')}
8. *Volume Permohonan (dalam satuan Liter, tulis nilainya saja, Contoh penulisan. 12000 ) : ${valOr('f_volume', '00')}
9. *Tonase Kapal GT Kapal (sesuai pas besar, Contoh. 29) : ${valOr('f_gt', '')}
10. *Tujuan pengisian solar (Pilih salah satu dengan hapus yang tidak perlu ) : ${valOr('f_tujuan_s', 'PPSC')}
11. *Nomor registrasi kapal BKP (5 digit terakhir) : ${valOr('f_bkp', '12345')}
12. *Rencana Lama Hari Operasi dalam 1 Trip : ${valOr('f_lama_hari', '00')}
13. *Permohonan :  ${valOr('f_jenis_s', 'BARU')}`;
  }

  $('result-preview').value = text;
}

function clearFormAll() {
  // f_desa & f_kec diganti f_alamat
  ['f_nama','f_nik','f_lama_jam','f_kapal','f_wa','f_mesin','f_alamat','f_sisa_solar','f_volume','f_gt','f_tujuan_p','f_selar','f_bkp','f_lama_hari'].forEach(id => {
    const el = $(id);
    if (el) { el.value = ''; el.classList.remove('input-error'); }
  });
  document.querySelectorAll('.err-msg').forEach(el => el.style.display = 'none');
  
  // FIX BUG: Paksa buka kunci WA dan kembalikan warna aslinya
  const inputWa = $('f_wa');
  if (inputWa) {
    inputWa.readOnly = false;
    inputWa.style.backgroundColor = ''; 
  }
  
  if (typeof resetValidasiWA === "function") resetValidasiWA();
  
  generatePreview();
  toast('🔄 Form direset & WA siap diisi ulang');
}

function copyFormText() {
  if (!cekValidasi()) return toast('⚠️ Perbaiki kolom yang masih merah terlebih dahulu!');
  const text = $('result-preview').value;
  navigator.clipboard.writeText(text).then(() => toast('✅ Format permohonan berhasil disalin!'));
}

function sendFormWA() {
  if (!cekValidasi()) return toast('⚠️ Perbaiki kolom yang masih merah sebelum mengirim!');
  const text = $('result-preview').value;
  const noTujuan = "6285156260107"; // Nomor WA Layanan sesuai script database Anda
  window.open(`https://wa.me/${noTujuan}?text=` + encodeURIComponent(text), '_blank');
}

// ── JEMBATAN SINKRONISASI PASTI TEMBUS KE TAB 2 (GOOGLE APPS SCRIPT) ──
function broadcastKeDalamIframe(win, payload) {
  try { win.postMessage(payload, '*'); } catch (e) {}
  try {
    for (let i = 0; i < win.frames.length; i++) {
      broadcastKeDalamIframe(win.frames[i], payload);
    }
  } catch (e) {}
}

function simpanKeTab2() {
  if (!cekValidasi()) return toast('⚠️ Perbaiki kotak merah sebelum menyimpan!');

  const pemilik = $('f_nama').value.trim();
  const kapal = $('f_kapal').value.trim();
  const selar = currentBBM === 'pertalite'
    ? ($('f_selar').value.trim() ? 'JTA no ' + $('f_selar').value.trim() : '')
    : $('f_bkp').value.trim();
  const text = $('result-preview').value;

  if (!pemilik || !kapal) {
    return toast('⚠️ Nama Pemilik dan Nama Kapal wajib diisi untuk disimpan ke Database!');
  }

  // Gunakan ID unik agar hanya diproses TEPAT 1 KALI
  const msgId = 'pwa_' + Date.now();
  const dataObj = { pemilik, kapal, selar, formwa: text, msgId };
  const payload = { action: 'simpan_dari_pwa', data: dataObj };

  const iframeTab2 = $('iframe_tab2');
  const sudahDimuat = iframeTab2 && iframeTab2.getAttribute('src');

  // Pindah ke Tab 2 (jika belum pernah dibuka, switchTab akan otomatis memuatnya)
  switchTab('tab2');

  if (sudahDimuat && iframeTab2.contentWindow) {
    // JIKA TAB 2 SUDAH DIMUAT: Langsung tembak 1x TANPA reload iframe (PIN tidak akan ke-reset / freeze)
    broadcastKeDalamIframe(iframeTab2.contentWindow, payload);
  } else if (iframeTab2) {
    // JIKA TAB 2 BARU PERTAMA KALI DIBUKA: Tunggu loading selesai, lalu kirim 1x
    iframeTab2.addEventListener('load', () => {
      setTimeout(() => {
        if (iframeTab2.contentWindow) {
          broadcastKeDalamIframe(iframeTab2.contentWindow, payload);
        }
      }, 600);
    }, { once: true });
  }

  toast('✅ Data berhasil disimpan ke Tab Data Form!');
  ;
}

document.addEventListener('DOMContentLoaded', () => {
  generatePreview();
});

// ═══════════════════════════════════════════
//  FITUR TAMBAHAN: IMPORT EXCEL & VALIDASI WA
// ═══════════════════════════════════════════

// --- 1. Fungsi Import dari Excel ---
// --- 1. Fungsi Import Cerdas (Bisa Teks WA & Excel) ---
function prosesImport() {
  const text = $('pasteArea').value;
  if (!text) return toast('⚠️ Area paste masih kosong!');

  // Fungsi pencari nilai setelah titik dua ":" berdasarkan nomor urut (1., 2., dst)
  const ambilData = (nomor) => {
    // Regex: Mencari baris yang diawali nomor urut, diikuti sembarang teks, titik dua, lalu menangkap isinya
    const regex = new RegExp(`^\\s*${nomor}\\.\\s*\\*?[^:]+:(.+)`, 'im');
    const hasil = text.match(regex);
    return hasil ? hasil[1].trim() : '';
  };

  // ➔ SKENARIO A: Cek apakah data ini hasil copy dari WhatsApp (ada nomor 1. dan titik dua)
  if (text.includes('1.') && text.includes(':')) {
    const d1 = ambilData(1); if(d1) $('f_nama').value = d1.toUpperCase();
    const d2 = ambilData(2); if(d2) $('f_nik').value = d2.replace(/\D/g,'');
    const d3 = ambilData(3); if(d3) $('f_lama_jam').value = d3.replace(/\D/g,'');
    const d4 = ambilData(4); if(d4) $('f_kapal').value = d4.toUpperCase();
    const d5 = ambilData(5); if(d5) $('f_wa').value = d5.replace(/\D/g,'');
    const d6 = ambilData(6); if(d6) $('f_mesin').value = d6.replace(/[^0-9.]/g,'');
    
    const d7 = ambilData(7); 
    if(d7) {
      if (currentBBM === 'solar') {
        $('f_sisa_solar').value = d7.replace(/\D/g,'');
      } else {
        $('f_alamat').value = d7.toUpperCase(); // Langsung isi 1 teksbox
      }
    }

    const d8 = ambilData(8); if(d8) $('f_volume').value = d8.replace(/\D/g,'');
    const d9 = ambilData(9); if(d9) $('f_gt').value = d9.replace(/[^0-9.]/g,'');
    
    const d10 = ambilData(10); if(d10) {
      if (currentBBM === 'solar') $('f_tujuan_s').value = d10.toUpperCase();
      else $('f_tujuan_p').value = d10.replace(/\D/g,'');
    }
    
    const d11 = ambilData(11); if(d11) {
      if (currentBBM === 'solar') $('f_bkp').value = d11.replace(/\D/g,'');
      else $('f_selar').value = d11.replace(/jta no/i, '').trim();
    }
    
    const d12 = ambilData(12); if(d12) $('f_lama_hari').value = d12.replace(/\D/g,'');
    
    const d13 = ambilData(13); if(d13) {
      // Menyesuaikan pilihan dropdown dengan teks yang di-paste
      if (currentBBM === 'solar') {
        const opt = Array.from($('f_jenis_s').options).find(o => o.value === d13.toUpperCase());
        if (opt) $('f_jenis_s').value = d13.toUpperCase();
      } else {
        const opt = Array.from($('f_jenis_p').options).find(o => o.value === d13.toUpperCase());
        if (opt) $('f_jenis_p').value = d13.toUpperCase();
      }
    }
  } 
  // ➔ SKENARIO B: Jika copy-paste murni dari baris Excel (pisahan kolom / Tab)
  else if (text.includes('\t')) {
    const arr = text.split('\t');
    if (arr[0]) $('f_nama').value = arr[0].trim().toUpperCase();
    if (arr[1]) $('f_nik').value = arr[1].replace(/\D/g,'');
    if (arr[2]) $('f_wa').value = arr[2].replace(/\D/g,'');
  } 
  else {
    return toast('⚠️ Format tidak dikenali. Pastikan teks memiliki format nomor urut atau dari Excel.');
  }

  // Refresh tampilan error merah dan preview
  if (typeof resetValidasiWA === "function") resetValidasiWA(); 
  cekValidasi();
  generatePreview();
  
  toast('✅ Data berhasil diimpor ke form!');
  $('pasteArea').value = '';
}

// --- 2. Fungsi Validasi WhatsApp ---
function bukaWaMe() {
  let noWa = $('f_wa').value;
  if (noWa.length < 9) {
    return toast('⚠️ Isi nomor WA terlebih dahulu!');
  }
  
  // Format ke 628
  if (noWa.startsWith('0')) {
    noWa = '62' + noWa.substring(1);
  }

  // Buka WhatsApp di tab baru
  window.open(`https://wa.me/${noWa}`, '_blank');

  // Ganti tombol cek menjadi tombol konfirmasi
  $('btnCekWa').style.display = 'none';$('grupKonfirmasiWa').style.display = 'block';
}

// --- 3. FUNGSI PENGUNCIAN FORM BAWAH & TOMBOL SUBMIT ---
function aturKunciFormBawah(dikunci) {
  // Daftar ID isian form dari nomor 6 sampai 13 (termasuk dropdown)
  const idIsian = ['f_mesin', 'f_alamat', 'f_sisa_solar', 'f_volume', 'f_gt', 'f_tujuan_p', 'f_tujuan_s', 'f_selar', 'f_bkp', 'f_lama_hari', 'f_jenis_p', 'f_jenis_s'];
  
  idIsian.forEach(id => {
    const elemen = $(id);
    if (elemen) {
      elemen.disabled = dikunci;
      elemen.style.backgroundColor = dikunci ? '#e2e8f0' : 'var(--bg)';
      elemen.style.cursor = dikunci ? 'not-allowed' : 'text';
    }
  });
  
  // Kunci juga tombol aksi (Simpan, Salin, Kirim WA) di area preview
  const tombolAksi = document.querySelectorAll('.preview-header button');
  tombolAksi.forEach(btn => {
    btn.disabled = dikunci;
    btn.style.opacity = dikunci ? '0.5' : '1';
    btn.style.cursor = dikunci ? 'not-allowed' : 'pointer';
  });
}

// Mengunci form secara otomatis saat aplikasi pertama kali dimuat
document.addEventListener('DOMContentLoaded', () => {
   aturKunciFormBawah(true);
});

// --- UPDATE FUNGSI WA (Ganti fungsi yang sebelumnya dengan ini) ---
function konfirmasiWaValid() {
  $('f_wa').readOnly = true;
  $('f_wa').style.backgroundColor = '#e2e8f0';
  $('grupKonfirmasiWa').style.display = 'none';
  
  // BUKA KUNCI isian bawah & tombol submit setelah WA divalidasi
  aturKunciFormBawah(false);
  toast('✅ Nomor WA Valid. Form lanjutan telah dibuka.');
}

function perbaikiWa() {
  $('btnCekWa').style.display = 'block';
  $('grupKonfirmasiWa').style.display = 'none';
  $('f_wa').readOnly = false;
  $('f_wa').style.backgroundColor = 'var(--bg)';
  $('f_wa').focus();
  
  // KUNCI KEMBALI isian bawah karena nomor belum valid
  aturKunciFormBawah(true);
}

function resetValidasiWA() {
  $('btnCekWa').style.display = 'block';
  if($('grupKonfirmasiWa')) $('grupKonfirmasiWa').style.display = 'none';
  $('f_wa').readOnly = false;
  $('f_wa').style.backgroundColor = 'var(--bg)';
  
  // KUNCI KEMBALI form bawah jika pemohon mengubah nomor WA di tengah jalan
  aturKunciFormBawah(true);
}

// ═══════════════════════════════════════════
//  WA RESEPSIONIS, MODE DEMO & PANDUAN INSTALASI
// ═══════════════════════════════════════════
// --- 4. FUNGSI POP-UP PUSAT BANTUAN ---
const NO_RESEPSIONIS = '6287730601432';
const NO_SISTEM_ELSHA = '6285156260107'; 
const LINK_GOOGLE_MEET = 'https://meet.google.com/meet/bps-zoro-rvg'; // Ganti dengan link statis/shortlink Anda nanti

// 1. Membuka pop-up pilihan kontak
function hubungiResepsionis() {
  if (window.refreshMeetBadge) refreshMeetBadge();
  const modal = $('contact-modal');
  const backdrop = $('contact-backdrop');
  if (modal && backdrop) {
    modal.hidden = false;
    backdrop.hidden = false;
  }
}

// PENYAMBUNG TOMBOL: Pastikan baris ini ada agar tombol bisa diklik
if ($('btnWaResepsionis')) {$('btnWaResepsionis').onclick = hubungiResepsionis;
}

// 2. Menutup pop-up pilihan kontak
function tutupKontak() {
  $('contact-modal').hidden = true;
  $('contact-backdrop').hidden = true;
}

// 3. Mengeksekusi rute berdasarkan tombol yang dipilih
function bukaLayanan(tipe) {
  tutupKontak(); 
  let link = '';
  
  if (tipe === 'resepsionis') {
    link = `https://wa.me/${NO_RESEPSIONIS}?text=${encodeURIComponent('Halo Resepsionis, saya butuh bantuan terkait layanan BBM...')}`;
  } 
  else if (tipe === 'elsha') {
    link = `https://wa.me/${NO_SISTEM_ELSHA}?text=${encodeURIComponent('Halo Elsha...')}`;
  } 
  else if (tipe === 'meet') {
    bukaFormMeet();
    return;
  } 
  else if (tipe === 'pengajuan') {
    link = `https://wa.me/${NO_SISTEM_ELSHA}`;
  }

  if (link) {
    window.open(link, '_blank');
  }
}
function openGuideModal(tab = 'demo') {
  $('guide-backdrop').hidden = false;
  $('guide-modal').hidden = false;
  switchGuideTab(tab);
}

function closeGuideModal() {
  $('guide-backdrop').hidden = true;
  $('guide-modal').hidden = true;
  try { localStorage.setItem('fuelstar_guide_seen', '1'); } catch (e) {}
}

function switchGuideTab(tab) {
  const isDemo = (tab === 'demo');
  $('gtab-demo').classList.toggle('active', isDemo);
  $('gtab-install').classList.toggle('active', !isDemo);$('gcontent-demo').style.display = isDemo ? 'flex' : 'none';
  $('gcontent-install').style.display = isDemo ? 'none' : 'flex';
  if (!isDemo) runInstallDiagnostics();
}

function tryFeature(tabId) {
  closeGuideModal();
  switchTab(tabId);
  toast('✨ Membuka fitur yang dipilih...');
}

if ($('btnHelpGuide'))$('btnHelpGuide').onclick = () => openGuideModal('demo');
if ($('btnCloseGuide'))$('btnCloseGuide').onclick = closeGuideModal;
if ($('guide-backdrop'))$('guide-backdrop').onclick = closeGuideModal;

// ═══════════════════════════════════════════
//  INSTALASI PWA + DIAGNOSA / TROUBLESHOOT
// ═══════════════════════════════════════════
let deferredInstallPrompt = null;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function setInstallBox(show) {
  const b = $('auto-install-box');
  if (b) b.style.display = show ? 'flex' : 'none';
}

// Chrome/Edge/Samsung Internet mengirim event ini jika aplikasi memenuhi syarat & belum terpasang
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  setInstallBox(true);
  if ($('gcontent-install') && $('gcontent-install').style.display !== 'none') runInstallDiagnostics();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  setInstallBox(false);
  toast('🎉 Fuel Star W.A berhasil diinstal!');
  runInstallDiagnostics();
});

if ($('btnTriggerInstall')) {
  $('btnTriggerInstall').onclick = async () => {
    if (!deferredInstallPrompt) {
      // Event sudah terpakai/hilang → jangan diam saja, arahkan ke diagnosa
      setInstallBox(false);
      toast('ℹ️ Izin instal belum tersedia. Menjalankan diagnosa…');
      runInstallDiagnostics();
      return;
    }
    const promptEvt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    setInstallBox(false);
    try {
      await promptEvt.prompt();
      const { outcome } = await promptEvt.userChoice;
      toast(outcome === 'accepted'
        ? '🎉 Terima kasih telah menginstal Fuel Star W.A!'
        : 'Instalasi dibatalkan. Jika tombol tidak muncul lagi, ketuk "Perbaiki & Muat Ulang".');
    } catch (err) {
      toast('⚠️ Gagal membuka dialog instal. Coba menu ⋮ Chrome → Instal aplikasi.');
    }
    runInstallDiagnostics();
  };
}

function detectEnv() {
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Telegram|TikTok|musical_ly|Snapchat|WhatsApp|GSA\/|; wv\)/i.test(ua);
  const edge = /EdgA|Edg\//.test(ua);
  const opera = /OPR\/|OPT\//.test(ua);
  const samsung = /SamsungBrowser/i.test(ua);
  const firefox = /Firefox|FxiOS/i.test(ua);
  const uc = /UCBrowser|UCWEB/i.test(ua);
  const chromeIOS = /CriOS/i.test(ua);
  const chrome = /Chrome\/\d/.test(ua) && !edge && !opera && !samsung && !uc && !firefox && !inApp;
  return { ua, iOS, android, inApp, edge, opera, samsung, firefox, uc, chromeIOS, chrome };
}

async function checkUrlOk(url, mustBeImage) {
  try {
    // Pastikan URL selalu absolut menggunakan location.origin sebagai basis yang valid
    let targetUrl = url;
    try {
      targetUrl = new URL(url, window.location.origin).href;
    } catch (e) {
      targetUrl = url;
    }

    const r = await fetch(targetUrl, { cache: 'no-store' });
    if (!r.ok) return { ok: false, why: 'HTTP ' + r.status };
    if (mustBeImage && !/^image\//i.test(r.headers.get('content-type') || '')) return { ok: false, why: 'bukan file gambar' };
    return { ok: true, res: r };
  } catch (e) {
    return { ok: false, why: 'tidak bisa diakses' };
  }
}

let diagRunning = false;
async function runInstallDiagnostics() {
  const out = $('ts-result');
  if (!out || diagRunning) return;
  diagRunning = true;
  out.innerHTML = '<div class="ts-row warn"><i class="material-icons-round">hourglass_top</i><div>Memeriksa kesiapan instalasi…</div></div>';

  const env = detectEnv();
  const rows = [];
  const add = (s, t, fix) => rows.push({ s, t, fix });
  let verdict = '';

  try {
    if (isStandalone()) {
      add('ok', 'Aplikasi sedang berjalan sebagai aplikasi terinstal di perangkat ini.');
      verdict = 'Tidak perlu instal lagi. Jika ingin memasang ulang, hapus ikon lama dulu lalu buka lewat browser.';
    } else if (env.iOS) {
      // iOS tidak punya dialog instal otomatis; harus manual lewat Safari
      const safariOk = !env.inApp && !env.firefox && !env.chromeIOS;
      add(safariOk ? 'ok' : 'bad',
        safariOk ? 'Browser Safari terdeteksi.' : 'Bukan Safari / sedang di dalam aplikasi lain.',
        safariOk ? '' : 'Salin link lalu buka di Safari. Dari WhatsApp/Instagram: ketuk ikon kompas/⋯ → "Buka di Safari".');
      const ti = await checkUrlOk('apple-touch-icon.png', true);
      add(ti.ok ? 'ok' : 'bad', ti.ok ? 'Ikon iPhone (apple-touch-icon) tersedia.' : 'Ikon iPhone tidak ditemukan (' + ti.why + ').');
      verdict = 'Di iPhone/iPad instal dilakukan manual: Bagikan (kotak panah ↑) → "Tambah ke Layar Utama" → Tambah. Jika ikon lama masih ada, hapus dulu ikon itu.';
    } else {
      // ── Android / Desktop ──
      if (window.isSecureContext) add('ok', 'Koneksi aman (HTTPS).');
      else add('bad', 'Halaman tidak dibuka lewat HTTPS.', 'Instal PWA hanya bisa dari alamat https://');

      if (env.inApp) {
        add('bad', 'Dibuka dari dalam aplikasi lain (WhatsApp/Facebook/Instagram/dll.).',
          'Ketuk ⋮ lalu pilih "Buka di Chrome" / "Open in browser". Instal tidak tersedia di browser bawaan aplikasi.');
      } else if (env.chrome || env.edge || env.samsung) {
        add('ok', 'Browser mendukung instal aplikasi.');
      } else {
        add('warn', 'Browser ini kurang mendukung instal otomatis.', 'Gunakan Google Chrome (disarankan).');
      }

      if (!('serviceWorker' in navigator)) {
        add('bad', 'Browser tidak mendukung Service Worker.', 'Perbarui atau ganti ke Google Chrome.');
      } else {
        let reg = null;
        try { reg = await navigator.serviceWorker.getRegistration(); } catch (e) {}
        if (!reg) add('bad', 'Service Worker belum terdaftar.', 'Ketuk "Perbaiki & Muat Ulang".');
        else if (reg.active) add('ok', 'Service Worker aktif.');
        else add('warn', 'Service Worker sedang disiapkan.', 'Tunggu beberapa detik lalu ketuk "Periksa Ulang".');
      }

      const mLink = document.querySelector('link[rel="manifest"]');
      const mHref = mLink ? mLink.href : 'manifest.json';
      const mr = await checkUrlOk(mHref, false);
      if (!mr.ok) {
        add('bad', 'File manifest.json tidak bisa dibuka (' + mr.why + ').', 'Pastikan manifest.json ter-upload di folder yang sama dengan index.html.');
      } else {
        let m = null;
        try { m = await mr.res.json(); } catch (e) {}
        if (!m) {
          add('bad', 'Isi manifest.json tidak valid.');
        } else {
          add('ok', 'Manifest terbaca: "' + (m.short_name || m.name || '?') + '".');
          for (const sz of ['192x192', '512x512']) {
            const ic = (m.icons || []).find(i => i.sizes === sz && (!i.purpose || /any/.test(i.purpose)));
            if (!ic) { add('bad', 'Ikon ' + sz + ' tidak terdaftar di manifest.'); continue; }
            
            // Perbaikan aman menggunakan base URL absolut dari halaman saat ini
            let iconTargetUrl = ic.src;
            try {
              iconTargetUrl = new URL(ic.src, location.href).href;
            } catch (e) {
              iconTargetUrl = ic.src;
            }
            
            const r = await checkUrlOk(iconTargetUrl, true);
            add(r.ok ? 'ok' : 'bad',
              r.ok ? 'Ikon ' + sz + ' tersedia.' : 'Ikon ' + sz + ' gagal dimuat (' + r.why + ').',
              r.ok ? '' : 'Upload file ' + ic.src + ' ke folder yang sama dengan index.html. Tanpa ikon ini Chrome tidak mengizinkan instal.');
          }
        }
      }

      if (deferredInstallPrompt) {
        add('ok', 'Chrome siap menginstal aplikasi ini.');
        verdict = 'Semua siap! Ketuk tombol hijau "Instal Sekarang" di atas.';
      } else {
        add('warn', 'Chrome belum memberi izin instal.',
          'Biasanya karena aplikasi sudah terpasang di HP ini, dialog baru saja dibatalkan, atau cache versi lama masih tersimpan.');
        const anyBad = rows.some(r => r.s === 'bad');
        verdict = anyBad
          ? 'Perbaiki dulu item bertanda ✖ di atas, lalu ketuk "Perbaiki & Muat Ulang".'
          : 'Cek menu ⋮ Chrome: jika tertulis "Buka Fuel Star W.A", aplikasi sudah terpasang (cari ikonnya di layar utama / laci aplikasi). Jika tertulis "Instal aplikasi", pilih itu. Jika tidak ada keduanya, ketuk "Perbaiki & Muat Ulang".';
      }
    }
  } catch (err) {
    add('bad', 'Diagnosa terhenti: ' + (err && err.message ? err.message : err));
  }

  const icon = { ok: 'check_circle', bad: 'cancel', warn: 'warning' };
  out.innerHTML = '';
  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'ts-row ' + r.s;
    const i = document.createElement('i');
    i.className = 'material-icons-round';
    i.textContent = icon[r.s];
    const d = document.createElement('div');
    const t = document.createElement('div');
    t.textContent = r.t;
    d.appendChild(t);
    if (r.fix) {
      const f = document.createElement('small');
      f.textContent = r.fix;
      d.appendChild(f);
    }
    row.appendChild(i);
    row.appendChild(d);
    out.appendChild(row);
  });
  if (verdict) {
    const v = document.createElement('div');
    v.className = 'ts-verdict';
    v.textContent = verdict;
    out.appendChild(v);
  }
  if (env.inApp && env.android) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn primary sm';
    b.style.marginTop = '6px';
    b.innerHTML = '<i class="material-icons-round">open_in_browser</i> Buka di Chrome';
    b.onclick = openInChrome;
    out.appendChild(b);
  }
  const sym = { ok: '[OK]', bad: '[GAGAL]', warn: '[PERHATIAN]' };
  lastDiagReport = [
    'LAPORAN DIAGNOSA FUEL STAR W.A',
    'Waktu: ' + new Date().toLocaleString('id-ID'),
    'URL: ' + location.href,
    'Mode terinstal (standalone): ' + isStandalone(),
    'Event instal Chrome tersedia: ' + !!deferredInstallPrompt,
    'Browser: ' + env.ua,
    '',
    ...rows.map(r => sym[r.s] + ' ' + r.t + (r.fix ? ' → ' + r.fix : '')),
    verdict ? '\nKesimpulan: ' + verdict : ''
  ].join('\n');
  diagRunning = false;
}

let lastDiagReport = '';

function openInChrome() {
  const u = new URL(location.href);
  location.href = 'intent://' + u.host + u.pathname + u.search +
    '#Intent;scheme=https;package=com.android.chrome;end';
}

async function copyDiagReport() {
  if (!lastDiagReport) await runInstallDiagnostics();
  try {
    await navigator.clipboard.writeText(lastDiagReport);
    toast('📋 Hasil diagnosa disalin. Tempel ke chat untuk dianalisa.');
  } catch (e) {
    window.prompt('Salin teks diagnosa ini:', lastDiagReport);
  }
}

// Perbaiki: hapus Service Worker & cache lama (data form/PIN di localStorage TIDAK disentuh), lalu muat ulang
async function repairPwa() {
  const btn = $('btnRepairPwa');
  if (btn) btn.disabled = true;
  toast('🔧 Membersihkan cache lama…');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {}
  try { sessionStorage.setItem('fuelstar_repaired', '1'); } catch (e) {}
  setTimeout(() => location.reload(), 600);
}

if ($('btnRunDiag')) $('btnRunDiag').onclick = () => runInstallDiagnostics();
if ($('btnRepairPwa')) $('btnRepairPwa').onclick = repairPwa;
if ($('btnCopyDiag')) $('btnCopyDiag').onclick = copyDiagReport;

// Setelah "Perbaiki": buka panduan instal otomatis & tunggu Chrome mengirim izin instal
window.addEventListener('DOMContentLoaded', () => {
  let repaired = false;
  try { repaired = sessionStorage.getItem('fuelstar_repaired') === '1'; sessionStorage.removeItem('fuelstar_repaired'); } catch (e) {}
  if (!repaired) return;
  setTimeout(() => {
    openGuideModal('install');
    toast('✅ Cache dibersihkan. Menunggu Chrome menyiapkan instalasi…');
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (deferredInstallPrompt || tries >= 10) {
        clearInterval(iv);
        runInstallDiagnostics();
      }
    }, 1000);
  }, 1200);
});

// Otomatis tampilkan Pengenalan Aplikasi saat pengguna baru pertama kali membuka web
window.addEventListener('DOMContentLoaded', () => {
  try {
    if (!localStorage.getItem('fuelstar_guide_seen')) {
      setTimeout(() => openGuideModal('demo'), 800);
    }
  } catch (e) {}
});


// ═══════════════════════════════════════════════════════════════
//  LIVE MEET (SISI PEMOHON). PWA hanya: cek status ONLINE → kirim data ke Firebase → masuk Google Meet.
//  Alarm & pengaturan ada di halaman terpisah: dashboard-resepsionis.html dan dashboard-petugas.html
// ═══════════════════════════════════════════════════════════════
(function () {
  const PESAN_TUTUP = '⛔ Live Meet sedang OFFLINE. Silakan hubungi Resepsionis via WhatsApp.';
  const DB = () => (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.databaseURL && !/ISI_/.test(FIREBASE_CONFIG.databaseURL)) ? FIREBASE_CONFIG.databaseURL.replace(/\/$/, '') : null;
  const ls = { get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

    async function cekLayanan() { // true=online, false=offline, null=tidak bisa dicek
    try {
      if (!DB()) return null;
      const c = new AbortController(), t = setTimeout(() => c.abort(), 5000);
      const r = await fetch(DB() + '/layanan/aktif.json', { signal: c.signal, cache: 'no-store' });
      clearTimeout(t); if (!r.ok) return null;
      return (await r.json()) === true;
    } catch (e) { return null; }
  }
  async function refreshMeetBadge() {
    const st = await cekLayanan();
    ['meet-badge', 'meet-status'].forEach(id => { const b = $(id); if (!b) return; b.className = 'meet-badge ' + (st === true ? 'on' : st === false ? 'off' : ''); b.textContent = st === true ? '● ONLINE' : st === false ? '● OFFLINE' : '● Status tidak diketahui'; });
    return st;
  }
  let poll = null;
  window.refreshMeetBadge = refreshMeetBadge;
  window.bukaFormMeet = async function () {
    toast('⏳ Mengecek ketersediaan Live Meet…');
    if ((await refreshMeetBadge()) === false) { toast(PESAN_TUTUP); return; }
    $('meet-nama').value = ls.get('fs_meet_nama'); $('meet-alamat').value = ls.get('fs_meet_alamat');
    $('meet-modal').hidden = false; $('meet-backdrop').hidden = false;
    clearInterval(poll); poll = setInterval(refreshMeetBadge, 8000);
  };
  window.tutupFormMeet = function () { $('meet-modal').hidden = true; $('meet-backdrop').hidden = true; clearInterval(poll); };
  window.mulaiPanggilan = async function () {
    const nama = $('meet-nama').value.trim(), alamat = $('meet-alamat').value.trim(), keperluan = $('meet-keperluan').value;
    if (nama.length < 3) { toast('⚠️ Isi nama lengkap'); $('meet-nama').focus(); return; }
    if (alamat.length < 5) { toast('⚠️ Isi alamat (desa/kecamatan)'); $('meet-alamat').focus(); return; }
    ls.set('fs_meet_nama', nama); ls.set('fs_meet_alamat', alamat);
    const w = window.open('', '_blank'); // dibuka di dalam klik agar tidak diblokir pop-up blocker
    const btn = $('btnMulaiMeet'); btn.disabled = true;
    if ((await cekLayanan()) === false) { if (w) w.close(); btn.disabled = false; tutupFormMeet(); toast(PESAN_TUTUP); return; }
    let ok = false;
    try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 6000);
      const r = await fetch(DB() + '/sesi.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: c.signal,
        body: JSON.stringify({ nama, alamat, keperluan, status: 'MENUNGGU', ts: { '.sv': 'timestamp' }, ts_update: { '.sv': 'timestamp' } }) });
      clearTimeout(t); ok = r.ok;
    } catch (e) {}
    btn.disabled = false; tutupFormMeet();
    toast(ok ? '✅ Resepsionis diberi tahu. Menunggu di Google Meet…' : '⚠️ Petugas belum bisa diberi tahu otomatis. Hubungi Resepsionis via WA.');
    if (w) w.location.href = LINK_GOOGLE_MEET; else window.location.href = LINK_GOOGLE_MEET;
  };

  
  // ── Panel Admin: saklar status + izin masuk dashboard ──
  async function muatSaklar() {
    const st = await cekLayanan(), sw = $('admLmSw');
    sw.checked = st === true; $('admLmWrap').classList.toggle('on', st === true);
    $('admLmText').textContent = st === true ? 'ONLINE' : st === false ? 'OFFLINE' : (DB() ? 'tidak terbaca' : 'isi firebase-config.js');
  }
  $('admLmSw').onchange = async e => {
    const on = e.target.checked;
    try {
      const r = await fetch(DB() + '/layanan.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktif: on, oleh: 'admin', ts: { '.sv': 'timestamp' } }) });
      if (!r.ok) throw 0; toast(on ? '🟢 Live Meet ONLINE' : '⚪ Live Meet OFFLINE');
    } catch (x) { e.target.checked = !on; toast('⚠️ Gagal menyimpan. Cek firebase-config.js & Rules'); }
    muatSaklar();
  };
  $('btnAdminLogin').addEventListener('click', () => { if (isAdminUnlocked) { ls.set('fs_admin_ok', String(Date.now())); muatSaklar(); } });
  $('btnAdminLogout').addEventListener('click', () => ls.set('fs_admin_ok', ''));

  // ═════════ FAQ / PETUNJUK TEKNIS (disimpan di Firebase /faq, dikelola dari Panel Admin) ═════════
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let faqData = [], faqEdit = null;
  function linkify(node, text) { // aman: hanya link http(s), sisanya teks biasa
    text.split(/(https?:\/\/[^\s]+)/g).forEach(p => {
      if (/^https?:\/\//.test(p)) { const a = mk('a', '', p); a.href = p; a.target = '_blank'; a.rel = 'noopener'; node.append(a); }
      else node.append(document.createTextNode(p));
    });
  }
  async function muatFaq() {
    try { faqData = JSON.parse(ls.get('fs_faq') || '[]'); } catch (e) { faqData = []; }
    renderFaq();
    if (!DB()) return;
    try {
      const r = await fetch(DB() + '/faq.json', { cache: 'no-store' }); if (!r.ok) throw 0;
      const o = (await r.json()) || {};
      faqData = Object.keys(o).map(id => Object.assign({ id }, o[id])).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      ls.set('fs_faq', JSON.stringify(faqData));
    } catch (e) {}
    renderFaq(); renderFaqAdmin();
  }
  function renderFaq() {
    const box = $('faq-list'); if (!box) return; box.innerHTML = '';
    const q = ($('faq-cari').value || '').trim().toLowerCase();
    const rows = faqData.filter(f => !q || (f.tanya + ' ' + f.jawab + ' ' + (f.kategori || '')).toLowerCase().includes(q));
    if (!rows.length) { box.append(mk('div', 'faq-empty', faqData.length ? 'Tidak ada hasil untuk pencarian ini.' : '📭 Petunjuk teknis & FAQ belum diisi. Silakan hubungi Resepsionis lewat menu Pusat Bantuan.')); return; }
    let last = null;
    rows.forEach(f => {
      const kat = f.kategori || 'Umum';
      if (kat !== last) { box.append(mk('div', 'faq-kat', kat)); last = kat; }
      const d = mk('details', 'faq-item'); d.append(mk('summary', '', f.tanya));
      const a = mk('div', 'faq-ans'); linkify(a, f.jawab); d.append(a); box.append(d);
    });
  }
  window.bukaFaq = function () { $('faq-modal').hidden = false; $('faq-backdrop').hidden = false; $('faq-cari').value = ''; muatFaq(); };
  window.tutupFaq = function () { $('faq-modal').hidden = true; $('faq-backdrop').hidden = true; };
  $('faq-cari').addEventListener('input', renderFaq);

  // ── Admin: tambah / ubah / hapus ──
  function renderFaqAdmin() {
    const box = $('faq-admin-list'); if (!box) return; box.innerHTML = '';
    $('faq-kat-list').innerHTML = ''; [...new Set(faqData.map(f => f.kategori).filter(Boolean))].forEach(k => { const o = document.createElement('option'); o.value = k; $('faq-kat-list').append(o); });
    faqData.forEach(f => {
      const r = mk('div', 'faq-adm-row'); r.append(mk('span', '', (f.kategori ? '[' + f.kategori + '] ' : '') + f.tanya));
      const e = mk('button', '', 'Edit'), x = mk('button', 'del', 'Hapus');
      e.onclick = () => { faqEdit = f; $('faq-kat').value = f.kategori || ''; $('faq-tanya').value = f.tanya; $('faq-jawab').value = f.jawab; $('btnFaqSave').lastChild.textContent = ' Simpan Perubahan'; $('btnFaqCancel').hidden = false; $('faq-tanya').focus(); };
      x.onclick = async () => { if (!confirm('Hapus FAQ ini?')) return; try { const rs = await fetch(DB() + '/faq/' + f.id + '.json', { method: 'DELETE' }); if (!rs.ok) throw 0; toast('🗑️ FAQ dihapus'); } catch (er) { toast('⚠️ Gagal menghapus'); } muatFaq(); };
      r.append(e, x); box.append(r);
    });
    if (!faqData.length) box.append(mk('small', 'adm-help', 'Belum ada FAQ. Isi form di atas lalu tekan Tambah.'));
  }
  function resetFaqForm() { faqEdit = null; ['faq-kat', 'faq-tanya', 'faq-jawab'].forEach(i => $(i).value = ''); $('btnFaqSave').lastChild.textContent = ' Tambah FAQ'; $('btnFaqCancel').hidden = true; }
  $('btnFaqCancel').onclick = resetFaqForm;
  $('btnFaqSave').onclick = async () => {
    const tanya = $('faq-tanya').value.trim(), jawab = $('faq-jawab').value.trim(), kategori = $('faq-kat').value.trim();
    if (tanya.length < 3 || jawab.length < 3) { toast('⚠️ Isi pertanyaan dan jawaban'); return; }
    if (!DB()) { toast('⚠️ Isi firebase-config.js terlebih dahulu'); return; }
    const body = { tanya, jawab, ts: faqEdit ? faqEdit.ts : Date.now() }; if (kategori) body.kategori = kategori;
    try {
      const rs = await fetch(DB() + (faqEdit ? '/faq/' + faqEdit.id + '.json' : '/faq.json'), { method: faqEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!rs.ok) throw 0; toast(faqEdit ? '✅ FAQ diperbarui' : '✅ FAQ ditambahkan'); resetFaqForm(); muatFaq();
    } catch (e) { toast('⚠️ Gagal menyimpan. Cek Rules Firebase (sudah Publish versi terbaru?)'); }
  };
  $('btnAdminLogin').addEventListener('click', () => { if (isAdminUnlocked) muatFaq(); });
})();
