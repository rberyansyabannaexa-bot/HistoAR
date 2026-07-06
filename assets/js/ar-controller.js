/**
 * ar-controller.js
 * Jalanin mode AR di materi-detail.html:
 * - cek lock/unlock materi
 * - init kamera + MindAR image tracking
 * - saat target ketemu PERTAMA KALI: kunci posisi (gak perlu terus2an ngarah ke marker),
 *   tampilin model default + audio intro (opsional)
 * - tiap hotspot diklik: model 3D ganti, audio ganti, teks ganti
 * - selama audio narator masih muter, hotspot lain di-lock (biar suara gak numpuk)
 *   dengan safety timeout biar gak ke-lock permanen kalau audio gagal load
 * - ada tombol reopen (floating) buat manggil ulang panel abis di-close, tanpa rescan
 * - gating: tombol "Lanjut ke Quiz" ke-disable sampe semua hotspot semua target dieksplor
 */

/**
 * Component custom buat muterin animasi GLB otomatis begitu model kelar di-load.
 * WAJIB didaftarin SEBELUM <a-scene> di-render (makanya ditaro di paling atas file,
 * sebelum buildScene()/initAR() dipanggil), soalnya A-Frame diem aja (gak error)
 * kalau nemu attribute custom yang componentnya belum terdaftar.
 */
AFRAME.registerComponent("autoplay-animations", {
  init: function () {
    this.mixer = null;
    this.el.addEventListener("model-loaded", (e) => {
      const model = e.detail.model;
      const animations = model.animations;
      if (!animations || !animations.length) return;

      this.mixer = new THREE.AnimationMixer(model);
      animations.forEach((clip) => {
        this.mixer.clipAction(clip).play();
      });
    });
  },
  tick: function (t, dt) {
    if (this.mixer) this.mixer.update(dt / 1000);
  },
});

const DEFAULT_SCALE = "0.3 0.3 0.3"; // fallback kalau target/hotspot gak nentuin scale sendiri
const AUDIO_LOCK_TIMEOUT_MS = 12000; // pengaman: paling lama hotspot ke-lock 12 detik, apapun yang terjadi ke audio

const visited = new Set(); // isi: "targetKey:hotspotId"
let currentAudio = null;
let audioBusy = false;
let audioTimeoutHandle = null;
let arConfig = null;
let materiMeta = null;
let activeTarget = null; // target yang lagi ke-lock/ditampilin

/**
 * Puter audio intro. INI GAK NGE-LOCK hotspot sama sekali - soalnya ini autoplay
 * yang sering di-block/didelay diam-diam sama browser HP, jadi gak bisa
 * diandalkan buat nentuin kapan siswa boleh mulai mijit hotspot.
 */
function playIntroAudio(src) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (!src) return;
  currentAudio = new Audio(src);
  currentAudio.play().catch(() => {
    /* browser block autoplay - gapapa, siswa tetep bebas mijit hotspot */
  });
}

/**
 * Puter audio hotspot (dipicu tap manual siswa, bukan autoplay). Selama audio
 * ini muter, semua tombol hotspot LAIN di-lock (disabled, abu-abu) biar gak ada
 * suara yang numpuk kalau siswa tap cepat-cepat gonta-ganti hotspot.
 * Ada safety timeout: kalau audio gagal load / event ended gak kepanggil,
 * hotspot tetep otomatis ke-unlock abis beberapa detik, gak permanen ke-lock.
 */
function playNarrationAudio(src, onEnded) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (audioTimeoutHandle) clearTimeout(audioTimeoutHandle);

  if (!src) {
    unlockHotspots();
    if (onEnded) onEnded();
    return;
  }

  lockHotspots();
  currentAudio = new Audio(src);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (audioTimeoutHandle) clearTimeout(audioTimeoutHandle);
    unlockHotspots();
    if (onEnded) onEnded();
  };

  currentAudio.addEventListener("ended", finish, { once: true });
  currentAudio.addEventListener("error", finish, { once: true }); // audio 404 / gagal load -> jangan lock permanen
  audioTimeoutHandle = setTimeout(finish, AUDIO_LOCK_TIMEOUT_MS); // jaring pengaman terakhir

  currentAudio.play().catch(finish); // browser block autoplay sebelum ada interaksi user -> jangan lock permanen
}

function lockHotspots() {
  audioBusy = true;
  document.querySelectorAll(".ar-hotspot-pill").forEach((el) => el.setAttribute("disabled", "true"));
}

function unlockHotspots() {
  audioBusy = false;
  document.querySelectorAll(".ar-hotspot-pill").forEach((el) => el.removeAttribute("disabled"));
}

function totalHotspotCount(config) {
  return config.targets.reduce((sum, t) => sum + t.hotspots.length, 0);
}

function updateGateButton() {
  const btn = document.getElementById("btnKeQuiz");
  const note = document.getElementById("arGateNote");
  if (!btn || !arConfig) return;

  const total = totalHotspotCount(arConfig);
  const done = visited.size;

  if (done >= total) {
    btn.removeAttribute("disabled");
    btn.textContent = "Lanjut ke Quiz →";
    if (note) note.textContent = "Semua bagian sudah dijelajahi. Mantap!";
  } else {
    btn.setAttribute("disabled", "true");
    btn.textContent = `🔒 Jelajahi semua bagian dulu (${done}/${total})`;
    if (note) note.textContent = `Sisa ${total - done} bagian lagi yang belum di-tap.`;
  }
}

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ROTATE_SPEED = 0.4; // derajat per pixel drag

let baseScaleVec = { x: 0.3, y: 0.3, z: 0.3 };
let zoomFactor = 1;
let rotY = 0;
let rotX = 0;

function parseScale(str) {
  const parts = (str || DEFAULT_SCALE).trim().split(/\s+/).map(Number);
  return { x: parts[0] || 0.3, y: parts[1] || 0.3, z: parts[2] || 0.3 };
}

/**
 * Terapkan zoom + rotasi manual siswa ke wrapper entity (bukan ke model
 * langsung, dan bukan ke entity anchor AR) - jadi gerakan ini murni visual,
 * gak ganggu tracking posisi AR-nya sama sekali.
 */
function applyWrapperTransform(targetKey) {
  const sceneRoot = document.getElementById("arSceneRoot");
  const wrapper = sceneRoot.querySelector(`[data-wrapper="${targetKey}"]`);
  if (!wrapper) return;
  const s = baseScaleVec;
  wrapper.setAttribute("scale", `${s.x * zoomFactor} ${s.y * zoomFactor} ${s.z * zoomFactor}`);
  wrapper.setAttribute("rotation", `${rotX} ${rotY} 0`);
}

/** Dipanggil tiap kali model diganti (hotspot baru) - reset zoom & rotasi ke default model itu. */
function setBaseScale(targetKey, scaleStr) {
  baseScaleVec = parseScale(scaleStr);
  zoomFactor = 1;
  rotY = 0;
  rotX = 0;
  applyWrapperTransform(targetKey);
}

function zoomIn() {
  if (!activeTarget) return;
  zoomFactor = Math.min(MAX_ZOOM, +(zoomFactor + ZOOM_STEP).toFixed(2));
  applyWrapperTransform(activeTarget.key);
}

function zoomOut() {
  if (!activeTarget) return;
  zoomFactor = Math.max(MIN_ZOOM, +(zoomFactor - ZOOM_STEP).toFixed(2));
  applyWrapperTransform(activeTarget.key);
}

function resetView() {
  if (!activeTarget) return;
  zoomFactor = 1;
  rotY = 0;
  rotX = 0;
  applyWrapperTransform(activeTarget.key);
}

/** Drag (mouse/jari) di area kamera buat muter model 360°. */
function initDragRotate() {
  const root = document.getElementById("arSceneRoot");
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  root.addEventListener("pointerdown", (e) => {
    if (!activeTarget) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging || !activeTarget) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * ROTATE_SPEED;
    rotX += dy * ROTATE_SPEED;
    applyWrapperTransform(activeTarget.key);
  });

  window.addEventListener("pointerup", () => { dragging = false; });
  window.addEventListener("pointercancel", () => { dragging = false; });
}

/**
 * Ganti model 3D (src) yang lagi ditampilin di atas target tertentu, sekalian
 * reset zoom/rotasi manualnya ke base scale bawaan model itu.
 */
function updateModel(targetKey, modelSrc, scale) {
  if (!modelSrc) return;
  const sceneRoot = document.getElementById("arSceneRoot");
  const modelEl = sceneRoot.querySelector(`[data-target-key="${targetKey}"] a-gltf-model`);
  if (!modelEl) return;
  modelEl.setAttribute("src", modelSrc);
  setBaseScale(targetKey, scale);
}

/**
 * Tampilin panel hotspot. isFirstOpen=true cuma dipanggil sekali (pas target
 * pertama kali kedeteksi) supaya intro audio gak keputer ulang tiap dibuka lagi
 * lewat tombol reopen.
 */
function openPanel(target, isFirstOpen) {
  const panel = document.getElementById("arPanel");
  const titleEl = document.getElementById("arPanelTitle");
  const hotspotRow = document.getElementById("arHotspotRow");
  const desc = document.getElementById("arPanelDesc");
  const dots = document.getElementById("arProgressDots");
  const reopenBtn = document.getElementById("arReopenBtn");

  panel.hidden = false;
  if (reopenBtn) reopenBtn.hidden = true;
  titleEl.textContent = target.label;

  hotspotRow.innerHTML = "";
  target.hotspots.forEach((h, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ar-hotspot-pill";
    if (visited.has(`${target.key}:${h.id}`)) btn.classList.add("is-visited-pill");
    btn.textContent = `${idx + 1}. ${h.label}`;
    btn.dataset.hotspotId = h.id;
    btn.addEventListener("click", () => selectHotspot(target, h, btn));
    hotspotRow.appendChild(btn);
  });

  dots.innerHTML = target.hotspots
    .map((h) => `<span class="ar-dot${visited.has(`${target.key}:${h.id}`) ? " is-visited" : ""}" data-hotspot-id="${h.id}"></span>`)
    .join("");

  if (isFirstOpen) {
    updateModel(target.key, target.model, target.scale);
    desc.textContent = "Pilih salah satu bagian di atas untuk mendengar & membaca penjelasannya.";
    playIntroAudio(target.introAudio);
  } else {
    desc.textContent = "Pilih salah satu bagian di atas untuk mendengar & membaca penjelasannya.";
  }
}

function selectHotspot(target, hotspot, btnEl) {
  if (audioBusy) return; // safety net, tombolnya juga udah ke-disable pas ini true

  const desc = document.getElementById("arPanelDesc");
  const hotspotRow = document.getElementById("arHotspotRow");
  const dots = document.getElementById("arProgressDots");

  hotspotRow.querySelectorAll(".ar-hotspot-pill").forEach((el) => el.classList.remove("is-active"));
  if (btnEl) {
    btnEl.classList.add("is-active");
    btnEl.classList.add("is-visited-pill");
  }

  updateModel(target.key, hotspot.model || target.model, hotspot.scale || target.scale);
  desc.textContent = hotspot.teks;
  playNarrationAudio(hotspot.audio, null);

  const key = `${target.key}:${hotspot.id}`;
  visited.add(key);

  const dot = dots.querySelector(`[data-hotspot-id="${hotspot.id}"]`);
  if (dot) dot.classList.add("is-visited");

  updateGateButton();
}

function closePanel() {
  const panel = document.getElementById("arPanel");
  const reopenBtn = document.getElementById("arReopenBtn");
  panel.hidden = true;
  if (currentAudio) currentAudio.pause();
  unlockHotspots();
  if (activeTarget && reopenBtn) reopenBtn.hidden = false; // baru boleh reopen kalau udah pernah ketemu target
}

async function initAR() {
  const id = window.HistoarRouter.getQueryParam("id");
  const container = document.getElementById("arRoot");

  try {
    const materiRes = await fetch("data/materi.json");
    const materiData = await materiRes.json();
    const list = materiData.materi;
    materiMeta = list.find((m) => m.id === id);

    if (!materiMeta) {
      container.innerHTML = `<div class="ar-blocked"><p>Materi tidak ditemukan.</p><a href="materi.html">Kembali ke daftar materi</a></div>`;
      return;
    }
    if (!window.HistoarProgress.isMateriUnlocked(list, materiMeta.id)) {
      container.innerHTML = `<div class="ar-blocked"><p>Materi ini masih terkunci. Selesaikan materi sebelumnya dulu ya.</p><a href="materi.html">Kembali ke daftar materi</a></div>`;
      return;
    }

    document.title = `Scan AR — ${materiMeta.judul} — Histoar`;
    const heading = document.getElementById("arHeading");
    if (heading) heading.textContent = materiMeta.judul;

    const arRes = await fetch("data/ar.json");
    const arData = await arRes.json();
    arConfig = arData[id];

    if (!arConfig) {
      container.innerHTML = `<div class="ar-blocked"><p>Belum ada konfigurasi AR untuk materi ini.</p><a href="materi.html">Kembali ke daftar materi</a></div>`;
      return;
    }

    buildScene(arConfig);
    updateGateButton();
    initDragRotate();

    const zoomInBtn = document.getElementById("btnZoomIn");
    const zoomOutBtn = document.getElementById("btnZoomOut");
    const resetBtn = document.getElementById("btnResetView");
    if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);
    if (resetBtn) resetBtn.addEventListener("click", resetView);

    const nextBtn = document.getElementById("btnKeQuiz");
    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        if (nextBtn.hasAttribute("disabled")) {
          e.preventDefault();
          return;
        }
        window.location.href = `hasil-quiz.html?id=${materiMeta.id}`;
      });
    }

    const closeBtn = document.getElementById("arPanelClose");
    if (closeBtn) closeBtn.addEventListener("click", closePanel);

    const reopenBtn = document.getElementById("arReopenBtn");
    if (reopenBtn) {
      reopenBtn.addEventListener("click", () => {
        if (activeTarget) openPanel(activeTarget, false);
      });
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="ar-blocked"><p>Gagal memuat mode AR. Coba muat ulang halaman.</p></div>`;
  }
}

/**
 * Bangun <a-scene> MindAR secara dinamis berdasarkan ar.json.
 * Setiap target di ar.json jadi satu <a-entity mindar-image-target>.
 * Sekali target ketemu, kita "kunci" biar objek gak ilang cuma gara-gara
 * marker sedikit keluar frame kamera - jadi cukup 1x scan aja.
 */
function buildScene(config) {
  const sceneRoot = document.getElementById("arSceneRoot");

  const targetsHtml = config.targets
    .map(
      (t) => `
      <a-entity mindar-image-target="targetIndex: ${t.targetIndex}" data-target-key="${t.key}">
        <a-entity class="ar-model-wrapper" data-wrapper="${t.key}" scale="${t.scale || DEFAULT_SCALE}" rotation="0 0 0">
          <a-gltf-model src="${t.model}" position="0 0 0" autoplay-animations></a-gltf-model>
        </a-entity>
      </a-entity>`
    )
    .join("");

  sceneRoot.innerHTML = `
    <a-scene mindar-image="imageTargetSrc: ${config.targetMind}; autoStart: true;"
      color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights"
      vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
      ${targetsHtml}
    </a-scene>
  `;

  config.targets.forEach((t) => {
    const el = sceneRoot.querySelector(`[data-target-key="${t.key}"]`);
    if (!el) return;

    el.addEventListener("targetFound", () => {
      const isFirstTime = !t._locked;
      t._locked = true;
      activeTarget = t;
      document.body.classList.add("ar-locked-in"); // sembunyiin UI "scanning" bawaan MindAR
      const hint = document.getElementById("arScanHint");
      if (hint) hint.hidden = true;
      const viewControls = document.getElementById("arViewControls");
      if (viewControls) viewControls.hidden = false;
      if (isFirstTime) openPanel(t, true);
    });

    // Sekali udah pernah "locked", paksa tetep keliatan walau marker keluar
    // frame kamera sebentar - biar siswa gak perlu rescan berkali-kali.
    el.addEventListener("targetLost", () => {
      if (t._locked && el.object3D) {
        requestAnimationFrame(() => {
          el.object3D.visible = true;
        });
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", initAR);

window.HistoarAR = { initAR };
