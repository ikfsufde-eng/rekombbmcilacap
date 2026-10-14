const $ = id => document.getElementById(id);
const DEFAULT_URL = 'https://sites.google.com/view/rekombbmcilacap/halaman-muka';
const BERKAS_OLD_BASE = 'https://script.google.com/macros/s/AKfycbzPTtwUl6RtXX3BBHg8f4LUnGj9Vf-lzHXl7zzesbuccTw5ekpTByGPb5cEnx84egUo/exec';
const BERKAS_NEW_BASE = 'https://script.google.com/macros/s/AKfycbyiD8iRCvsPfws2lzAcuuGtd52RE3aqtdv7Q4GeALqdCMi0eVN7_SFpPiYqU8s21i85/exec';

// ═══════════════════════════════════════════
//  TOAST & AUDIO FEEDBACK (WEB AUDIO API)
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

function updateNetStatus() {
  const badge = $('net-badge');
  if (!badge) return;
  if (navigator.onLine) {
    badge.className = 'status-pill online';
    badge.innerHTML = '<span class="dot"></span>Online';
  } else {
    badge.className = 'status-pill offline';
    badge.innerHTML = '<span class="dot"></span>Offline';
    toast('⚠️ Koneksi internet terputus (Mode Offline)');
  }
}
window.addEventListener('online', () => { updateNetStatus(); toast('✅ Kembali terhubung ke internet'); });
window.addEventListener('offline', updateNetStatus);
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

// Tombol Quick Scan di Header
$('btnQuickScan').onclick = () => { switchTab('tab4'); mulaiScan(); };$('btnEmptyScan').onclick = () => mulaiScan();

// ═══════════════════════════════════════════
//  TAB 4: BUKA LINK, ZOOM, & RIWAYAT
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

function normalisasi(v) {
  v = v.trim();
  if (!v) return '';
  // Jika berupa URL Berkas Digital lama, arahkan ke URL baru seperti logika QR9
  if (v.includes(BERKAS_OLD_BASE)) {
    v = v.replace(BERKAS_OLD_BASE, BERKAS_NEW_BASE);
  }
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
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

function bukaLink() {
  let raw = $('linkInput').value.trim();
  if (!raw) return toast('Masukkan link atau scan QR terlebih dahulu');

  // Jika input adalah kode ID pendek (misal: A-223344), buka di Cek Status
  if (/^[A-Za-z]-\d+$/i.test(raw)) {
    const cekUrl = `https://script.google.com/macros/s/AKfycbyIkDej3qauwaYyPRwZzqoVnGDPhJKfjx1wT4sJrv-JTl0JQ2AOB-YLeKGlhLswagnD4w/exec?id=${encodeURIComponent(raw)}`;
    raw = cekUrl;
  }

  const url = normalisasi(raw);
  $('linkInput').value = url;
  toggleClearBtn();
  saveHistory(url);

  $('empty-state').style.display = 'none';
  viewer.style.display = 'block';
  $('hint').style.display = 'flex';
  aturModeDesktop();
  mulaiLoading();
  viewer.src = url;
}

viewer.addEventListener('load', () => { if (viewer.getAttribute('src')) selesaiLoading(); });
$('btnBuka').onclick = bukaLink;
$('btnDefault').onclick = () => bukaEksternal(DEFAULT_URL);
$('btnHint').onclick = () => bukaEksternal(normalisasi($('linkInput').value));
$('hintClose').onclick = () => {$('hint').style.display = 'none'; };
$('linkInput').addEventListener('keydown', e => { if (e.key === 'Enter') bukaLink(); });$('btnReload').onclick = () => {
  const u = normalisasi($('linkInput').value);
  if (u) { mulaiLoading(); viewer.src = u; } else toast('Belum ada halaman dibuka');
};
$('btnExternal').onclick = () => {
  const u = normalisasi($('linkInput').value);
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
//  QR9 SCANNER ENGINE (DARI SCRIPT CONTOH)
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
let isDecodeMode = false;
const SECRET_KEY = 55; // Kunci XOR simetris sesuai rumus Google Sheet

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

// Pembongkar Enkripsi XOR Hex (ENC-...)
function decodeToken(tokenStr) {
  try {
    if (!tokenStr.startsWith('ENC-')) return null;
    const hex = tokenStr.replace('ENC-', '').trim();
    let rawText = '';
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      rawText += String.fromCharCode(charCode ^ SECRET_KEY);
    }
    const parts = rawText.split('|');
    if (parts.length >= 1 && parts[0]) {
      return {
        id: parts[0].trim(),
        nama: parts[1] ? parts[1].trim() : '',
        kapal: parts[2] ? parts[2].trim() : ''
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Toggle Decode Mode & Sound Mode
$('btn-decode-mode').onclick = function() {
  isDecodeMode = !isDecodeMode;
  this.textContent = isDecodeMode ? '🔓 Decode: ON' : '🔒 Decode: OFF';
  this.classList.toggle('on', isDecodeMode);
  setScanResult(isDecodeMode
    ? '🔓 Mode Decode ON: Token ENC-... otomatis diekstrak menjadi ID.'
    : '🔒 Mode Decode OFF: Membaca QR Link / Teks standar.', 'info');
};

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
          // Peningkatan kontras piksel seperti script QR9
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

function handleScan(decodedText) {
  let id = String(decodedText).trim();
  if (!id) return;

  // Cegah duplikasi scan beruntun dalam 4 detik
  if (id === lastScannedID && (Date.now() - lastScannedTime < 4000)) return;
  lastScannedID = id;
  lastScannedTime = Date.now();

  // Feedback suara & getar
  playBeep(920, 130);
  if (navigator.vibrate) navigator.vibrate(100);

  // Cek apakah token terenkripsi ENC-
  if (isDecodeMode || id.startsWith('ENC-')) {
    if (id.startsWith('ENC-')) {
      const tokenData = decodeToken(id);
      if (tokenData && tokenData.id) {
        id = tokenData.id;
        addAppNotification(
          'QR Token Terdekripsi',
          `Berhasil mengekstrak ID: ${tokenData.id} ${tokenData.nama ? '(' + tokenData.nama + ')' : ''}`
        );
      } else if (isDecodeMode) {
        setScanResult('❌ Token QR (ENC) tidak valid / rusak.', 'err');
        setScanDot('err');
        cooldownUntil = Date.now() + 2000;
        return;
      }
    }
  }

  setScanResult('✅ Terbaca: ' + id, 'ok');
  $('linkInput').value = id;
  toggleClearBtn();

  setTimeout(() => {
    stopCamera(false);
    bukaLink();
  }, 450);
}

// Scan dari File Gambar (Menggunakan FileReader & Image seperti script QR9)
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
//  PUSAT NOTIFIKASI & PUSH MESSAGE PELAYANAN
// ═══════════════════════════════════════════
const NOTIF_KEY = 'fuelstar_notifications_v1';
const defaultNotifs = [
  {
    id: 'n1',
    title: 'Selamat Datang di Fuel Star W.A',
    body: 'Gunakan menu Cek Status untuk memantau proses rekomendasi BBM, atau menu Scan QR untuk verifikasi berkas digital cepat.',
    time: 'Hari ini',
    unread: true,
    icon: 'verified'
  },
  {
    id: 'n2',
    title: 'Pembaruan Pemindai QR Code (QR9 Engine)',
    body: 'Pemindai QR kini mendukung fokus otomatis, pembacaan QR buram, serta dekripsi otomatis token ENC.',
    time: 'Info Sistem',
    unread: true,
    icon: 'qr_code_scanner'
  },
  {
    id: 'n3',
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
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
  renderNotifs();
}

function renderNotifs() {
  const list = getNotifs();
  const unreadCount = list.filter(n => n.unread).length;
  const badge = $('notif-badge');
  badge.textContent = unreadCount;
  badge.classList.toggle('hidden', unreadCount === 0);

  $('notif-list').innerHTML = list.map(n => `
    <div class="notif-card ${n.unread ? 'unread' : ''}" data-id="${n.id}">
      <div class="notif-icon"><i class="material-icons-round">${n.icon || 'notifications'}</i></div>
      <div class="notif-body">
        <h4>${n.title}</h4>
        <p>${n.body}</p>
        <span class="notif-time">${n.time}</span>
      </div>
    </div>
  `).join('');
}

function addAppNotification(title, body, icon = 'notifications_active') {
  const list = getNotifs();
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  list.unshift({ id: 'n_' + Date.now(), title, body, time, unread: true, icon });
  saveNotifs(list);
  sendBrowserPush(title, body);
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

$('btnEnablePush').onclick = async () => {
  if (!('Notification' in window)) return toast('Browser ini tidak mendukung Push Notification');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    $('push-banner').style.display = 'none';
    toast('✅ Notifikasi Push berhasil diaktifkan!');
    sendBrowserPush('Fuel Star W.A Aktif', 'Anda akan menerima notifikasi layanan secara langsung.');
  } else {
    toast('⚠️ Izin notifikasi belum diberikan');
  }
};

$('btnTestPush').onclick = () => {
  playBeep(740, 100);
  addAppNotification(
    'Informasi Layanan BBM',
    'Sistem sinkronisasi rekomendasi BBM dan berkas digital berjalan normal dan siap melayani.'
  );
  toast('🔔 Pesan notifikasi baru diterima');
};

renderNotifs();

// ═══════════════════════════════════════════
//  SERVICE WORKER & INIT
// ═══════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW gagal:', err));
  });
}

let last = 'tab1';
try { last = localStorage.getItem('lastTab') || 'tab1'; } catch (e) {}
switchTab(last);