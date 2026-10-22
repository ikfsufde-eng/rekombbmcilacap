// Logika bersama Dashboard Resepsionis & Petugas Teknis. Konfigurasi peran ada di window.DASH.
(function () {
  const D = window.DASH, $ = id => document.getElementById(id);
  const STALE_MS = 30 * 60 * 1000; // data lebih tua dari 30 menit tidak membunyikan alarm
  firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.database(), ref = db.ref('panggilan');

  let data = null, armed = false, mutedKey = null, wakeLock = null, audioCtx = null, sirenT = null, ringing = false, titleT = null;
  const audio = new Audio('alarm.mp3'); audio.loop = true; audio.preload = 'auto';
  let mp3Broken = false; audio.addEventListener('error', () => { mp3Broken = true; });

  // ── Suara ────────────────────────────────────────────
  function sirenStart() {
    if (sirenT || !audioCtx) return;
    let hi = false;
    const beep = () => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = hi ? 980 : 720; hi = !hi;
      g.gain.value = 0.35; o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.4);
    };
    beep(); sirenT = setInterval(beep, 450);
  }
  function sirenStop() { clearInterval(sirenT); sirenT = null; }
  function alarmStart() {
    if (ringing) return; ringing = true;
    audio.volume = 1;
    audio.play().catch(() => sirenStart());
    if (mp3Broken) sirenStart();
    let on = false; titleT = setInterval(() => { document.title = (on = !on) ? '🚨 PANGGILAN MASUK!' : D.title; }, 700);
  }
  function alarmStop() {
    ringing = false; audio.pause(); audio.currentTime = 0; sirenStop();
    clearInterval(titleT); document.title = D.title;
  }

  // ── Aktivasi (wajib 1 klik agar browser mengizinkan suara) ──
  async function arm() {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); await audioCtx.resume(); } catch (e) {}
    try { audio.muted = true; await audio.play(); audio.pause(); audio.currentTime = 0; audio.muted = false; } catch (e) { audio.muted = false; }
    armed = true; $('arm').classList.add('hide');
    lockScreen(); render();
  }
  async function lockScreen() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && armed) lockScreen(); });
  $('btnArm').onclick = arm;

  // ── Data ─────────────────────────────────────────────
  const key = d => d ? d.ts + '|' + d.status : null;
  const fresh = d => d && (Date.now() - (d.ts_update || d.ts || 0)) < STALE_MS;
  const ago = ts => { const s = Math.max(0, Math.round((Date.now() - ts) / 1000)); return s < 60 ? s + ' detik lalu' : Math.round(s / 60) + ' menit lalu'; };

  function setStatus(status) {
    return ref.update({ status, ts_update: firebase.database.ServerValue.TIMESTAMP });
  }

  function render() {
    const card = $('card'), act = $('actions');
    act.innerHTML = '';
    const btn = (txt, cls, fn) => { const b = document.createElement('button'); b.textContent = txt; b.className = cls; b.onclick = fn; act.appendChild(b); };

    const live = data && fresh(data) && data.status !== 'SELESAI';
    const shouldRing = armed && live && data.status === D.alarmOn && mutedKey !== key(data);
    shouldRing ? alarmStart() : alarmStop();

    if (!live) {
      card.className = 'card idle';
      $('badge').className = 'badge'; $('badge').textContent = 'SIAGA';
      $('nama').className = 'big'; $('nama').textContent = 'Belum ada panggilan';
      $('kep').textContent = 'Layar ini memantau panggilan secara otomatis.'; $('age').textContent = '';
      return;
    }
    $('badge').className = 'badge ' + data.status; $('badge').textContent = data.status;
    $('nama').className = 'big'; $('nama').textContent = data.nama;
    $('kep').textContent = 'Keperluan: ' + data.keperluan;
    $('age').textContent = 'Masuk ' + ago(data.ts);
    card.className = 'card ' + (shouldRing ? 'ring' : (data.status === D.alarmOn ? 'info' : 'idle'));
    D.buttons(data, { btn, setStatus, mute: () => { mutedKey = key(data); render(); } });
  }

  ref.on('value', s => { data = s.val(); render(); });
  db.ref('.info/connected').on('value', s => {
    const p = $('conn'); p.className = 'pill ' + (s.val() ? 'on' : 'off'); p.textContent = s.val() ? '● Terhubung' : '● Terputus';
  });
  setInterval(render, 15000); // perbarui umur panggilan & kadaluarsa

  $('btnTest').onclick = () => { if (!armed) return arm(); ringing ? alarmStop() : (alarmStart(), setTimeout(alarmStop, 4000)); };
  document.title = D.title;
})();
