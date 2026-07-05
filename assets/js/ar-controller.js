/**
 * ar-controller.js
 * Jalanin mode AR di materi-detail.html:
 * - cek lock/unlock materi
 * - init kamera + MindAR image tracking
 * - tampilin panel hotspot (HTML overlay, bukan objek 3D) saat target ketemu
 * - gating: tombol "Lanjut ke Quiz" ke-disable sampe semua hotspot semua target dieksplor
 */

const visited = new Set(); // isi: "targetKey:hotspotId"
let currentAudio = null;
let arConfig = null;
let materiMeta = null;

function playAudio(src) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (!src) return;
  currentAudio = new Audio(src);
  currentAudio.play().catch(() => {
    /* browser mungkin nge-block autoplay sebelum ada interaksi user - aman diabaikan */
  });
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

  desc.textContent = "Pilih salah satu bagian di atas untuk mendengar & membaca penjelasannya.";

  // auto-pilih hotspot pertama biar siswa langsung dapet sesuatu
  selectHotspot(target, target.hotspots[0], hotspotRow.firstElementChild);
}

function selectHotspot(target, hotspot, btnEl) {
  const desc = document.getElementById("arPanelDesc");
  const hotspotRow = document.getElementById("arHotspotRow");
  const dots = document.getElementById("arProgressDots");

  hotspotRow.querySelectorAll(".ar-hotspot-pill").forEach((el) => el.classList.remove("is-active"));
  if (btnEl) btnEl.classList.add("is-active");

  desc.textContent = hotspot.teks;
  playAudio(hotspot.audio);

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
