/**
 * ar-controller.js
 * Jalanin mode AR di materi-detail.html:
 * - cek lock/unlock materi
 * - init kamera + MindAR image tracking
 * - saat target ketemu: tampilin model default + audio intro (opsional)
 * - tiap hotspot diklik: model 3D ganti, audio ganti, teks ganti
 * - selama audio narator masih muter, hotspot lain di-lock (biar suara gak numpuk)
 * - gating: tombol "Lanjut ke Quiz" ke-disable sampe semua hotspot semua target dieksplor
 */

const visited = new Set(); // isi: "targetKey:hotspotId"
let currentAudio = null;
let audioBusy = false;
let arConfig = null;
let materiMeta = null;

/**
 * Puter audio narator. Selama audio ini muter, semua tombol hotspot di-lock
 * (disabled, abu-abu) biar gak ada suara yang numpuk kalau siswa tap cepat-cepat.
 * onEnded dipanggil begitu audio kelar (atau langsung kalau src kosong).
 */
function playNarrationAudio(src, onEnded) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  if (!src) {
    unlockHotspots();
    if (onEnded) onEnded();
    return;
  }

  lockHotspots();
  currentAudio = new Audio(src);

  const finish = () => {
    unlockHotspots();
    if (onEnded) onEnded();
  };

  currentAudio.addEventListener("ended", finish, { once: true });
  currentAudio.play().catch(() => {
    // browser mungkin nge-block autoplay sebelum ada interaksi user pertama - jangan sampe ke-lock permanen
    finish();
  });
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

/**
 * Ganti model 3D yang lagi ditampilin di atas target tertentu.
 * A-Frame otomatis reload model begitu atribut src-nya di-update.
 */
function updateModel(targetKey, modelSrc) {
  if (!modelSrc) return;
  const sceneRoot = document.getElementById("arSceneRoot");
  const modelEl = sceneRoot.querySelector(`[data-target-key="${targetKey}"] a-gltf-model`);
  if (modelEl) modelEl.setAttribute("src", modelSrc);
}

function renderHotspotPanel(target) {
  const panel = document.getElementById("arPanel");
  const titleEl = document.getElementById("arPanelTitle");
  const hotspotRow = document.getElementById("arHotspotRow");
  const desc = document.getElementById("arPanelDesc");
  const dots = document.getElementById("arProgressDots");

  panel.hidden = false;
  titleEl.textContent = target.label;

  hotspotRow.innerHTML = "";
  target.hotspots.forEach((h, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ar-hotspot-pill";
    btn.textContent = `${idx + 1}. ${h.label}`;
    btn.dataset.hotspotId = h.id;
    btn.addEventListener("click", () => selectHotspot(target, h, btn));
    hotspotRow.appendChild(btn);
  });

  dots.innerHTML = target.hotspots
    .map((h) => `<span class="ar-dot" data-hotspot-id="${h.id}"></span>`)
    .join("");

  // Tampilkan model default (mis. "sekarang.glb") dan puter narasi intro (kalau ada),
  // TANPA menghitungnya sebagai hotspot yang sudah dikunjungi.
  updateModel(target.key, target.model);
  desc.textContent = "Pilih salah satu bagian di atas untuk mendengar & membaca penjelasannya.";
  playNarrationAudio(target.introAudio, null);
}

function selectHotspot(target, hotspot, btnEl) {
  if (audioBusy) return; // safety net, tombolnya juga udah ke-disable pas ini true

  const desc = document.getElementById("arPanelDesc");
  const hotspotRow = document.getElementById("arHotspotRow");
  const dots = document.getElementById("arProgressDots");

  hotspotRow.querySelectorAll(".ar-hotspot-pill").forEach((el) => el.classList.remove("is-active"));
  if (btnEl) btnEl.classList.add("is-active");

  updateModel(target.key, hotspot.model || target.model);
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
  panel.hidden = true;
  if (currentAudio) currentAudio.pause();
  unlockHotspots();
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
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="ar-blocked"><p>Gagal memuat mode AR. Coba muat ulang halaman.</p></div>`;
  }
}

/**
 * Bangun <a-scene> MindAR secara dinamis berdasarkan ar.json.
 * Setiap target di ar.json jadi satu <a-entity mindar-image-target>.
 * Model 3D awal dipasang, nanti di-swap dinamis oleh updateModel().
 */
function buildScene(config) {
  const sceneRoot = document.getElementById("arSceneRoot");

  const targetsHtml = config.targets
    .map(
      (t) => `
      <a-entity mindar-image-target="targetIndex: ${t.targetIndex}" data-target-key="${t.key}">
        <a-gltf-model src="${t.model}" position="0 0 0" scale="0.05 0.05 0.05" rotation="0 0 0"></a-gltf-model>
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

  // dengerin event targetFound dari tiap entity target
  config.targets.forEach((t) => {
    const el = sceneRoot.querySelector(`[data-target-key="${t.key}"]`);
    if (!el) return;
    el.addEventListener("targetFound", () => renderHotspotPanel(t));
  });
}

document.addEventListener("DOMContentLoaded", initAR);

window.HistoarAR = { initAR };
