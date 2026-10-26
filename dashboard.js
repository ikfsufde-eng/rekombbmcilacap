// Logika bersama dua dashboard terpisah. Perbedaan peran ada di window.DASH (lihat masing-masing file .html)
(function () {
  const D = window.DASH, $ = id => document.getElementById(id);
  const STALE = 30 * 60 * 1000, TTL = 24 * 3600 * 1000;
  document.body.classList.add('role-' + D.role);
  firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.database(), sesiRef = db.ref('sesi'), layRef = db.ref('layanan');
  const SV = firebase.database.ServerValue.TIMESTAMP;
  let list = [], armed = false, nama = '', muted = new Set(), ringing = false, ctx = null, sirenT = null, titleT = null, bad = false;
  const au = new Audio('alarm.mp3'); au.loop = true; au.onerror = () => { bad = true; };
  try { $('nama').value = localStorage.getItem('fs_' + D.role) || ''; } catch (e) {}

  function siren() {
    if (sirenT || !ctx) return; let hi = false;
    const b = () => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = (hi = !hi) ? 980 : 720; g.gain.value = .35; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .35); };
    b(); sirenT = setInterval(b, 500);
  }
  function alarmOn(txt) { if (ringing) return; ringing = true; au.play().catch(siren); if (bad) siren(); let f = false; titleT = setInterval(() => document.title = (f = !f) ? txt : D.title, 700); }
  function alarmOff() { if (!ringing) return; ringing = false; au.pause(); au.currentTime = 0; clearInterval(sirenT); sirenT = null; clearInterval(titleT); document.title = D.title; }

  $('btnArm').onclick = async () => {
    if ($('pin').value !== D.pin) { $('err').textContent = 'PIN salah'; return; }
    nama = $('nama').value.trim(); if (nama.length < 2) { $('err').textContent = 'Isi nama Anda'; return; }
    try { localStorage.setItem('fs_' + D.role, nama); } catch (e) {}
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume(); } catch (e) {}
    try { au.muted = true; await au.play(); au.pause(); au.currentTime = 0; } catch (e) {} au.muted = false;
    armed = true; $('arm').classList.add('hide'); lock();
    if (D.role === 'PETUGAS') sesiRef.orderByChild('ts').endAt(Date.now() - TTL).once('value', s => s.forEach(c => { c.ref.remove(); }));
    render();
  };
  function lock() { try { if ('wakeLock' in navigator) navigator.wakeLock.request('screen'); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && armed) lock(); });

  const upd = s => s.ts_update || s.ts || 0, fresh = s => Date.now() - upd(s) < STALE, key = s => s.id + '|' + s.status;
  const ago = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'baru saja' : m + ' menit lalu'; };
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }; // textContent: data dari input pemohon

  sesiRef.orderByChild('ts').limitToLast(50).on('value', snap => { list = []; snap.forEach(c => { list.push(Object.assign({ id: c.key }, c.val())); }); render(); });
  layRef.on('value', s => { const on = !!(s.val() && s.val().aktif === true); $('swLayanan').checked = on; $('swWrap').classList.toggle('on', on); $('swText').textContent = on ? 'LIVE MEET ONLINE' : 'LIVE MEET OFFLINE'; });
  if (D.canSwitch) $('swLayanan').onchange = e => layRef.set({ aktif: e.target.checked, oleh: nama || 'petugas', ts: SV });
  else $('swWrap').classList.add('ro');
  db.ref('.info/connected').on('value', s => { const p = $('conn'); p.className = 'pill ' + (s.val() ? 'on' : 'off'); p.textContent = s.val() ? '● Terhubung' : '● Terputus'; });

  const ORDER = { DIESKALASI: 0, MENUNGGU: 1, DITERIMA: 2, DITANGANI: 3 };
  function render() {
    const box = $('list'); box.innerHTML = ''; let hotS = null;
    const aktif = list.filter(s => s.status !== 'SELESAI').sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || (b.ts - a.ts));
    aktif.forEach(s => {
      const hot = armed && fresh(s) && !muted.has(key(s)) && D.ringOn.includes(s.status);
      if (hot && !hotS) hotS = s;
      const c = el('div', 'card' + (hot ? ' ring' : '')), top = el('div', 'top'), l = el('div');
      l.append(el('div', 'nama', s.nama), el('div', 'meta', '📍 ' + s.alamat), el('div', 'meta', 'Keperluan: ' + s.keperluan + ' · ' + ago(s.ts)));
      top.append(l, el('span', 'badge ' + s.status, s.status === 'DIESKALASI' ? 'MEMINTA PETUGAS' : s.status));
      const who = el('div', 'who');
      who.append(el('span', 'chip pemohon', '🟦 PEMOHON: ' + s.nama),
        s.resepsionis ? el('span', 'chip resepsionis', '🟩 RESEPSIONIS: ' + s.resepsionis) : el('span', 'chip none', 'Resepsionis belum masuk'),
        s.petugas ? el('span', 'chip petugas', '🟧 PETUGAS: ' + s.petugas) : el('span', 'chip none', 'Petugas belum masuk'));
      const act = el('div', 'actions'), r = sesiRef.child(s.id);
      const add = (t, cls, f) => { const b = el('button', cls, t); b.onclick = f; act.append(b); };
      D.actions(s, { add, nama, update: f => r.update(Object.assign({ ts_update: SV }, f)), open: () => window.open(MEET_LINK, '_blank') });
      if (hot) add('🔇 Diam', 'ghost', () => { muted.add(key(s)); render(); });
      c.append(top, who, act); box.append(c);
    });
    if (!aktif.length) box.append(el('div', 'empty', 'Belum ada pemohon. Layar ini memantau otomatis.'));
    const done = list.filter(s => s.status === 'SELESAI').sort((a, b) => upd(b) - upd(a)).slice(0, 6);
    $('hist').textContent = done.length ? 'Selesai terakhir: ' + done.map(s => s.nama + ' (' + s.keperluan + ')').join(' · ') : '';
    hotS ? alarmOn(D.ringText) : alarmOff();
  }
  setInterval(render, 15000);
  $('btnTest').onclick = () => { if (!armed) return; alarmOn('🔔 TES ALARM'); setTimeout(alarmOff, 3500); };
  document.title = D.title;
})();
