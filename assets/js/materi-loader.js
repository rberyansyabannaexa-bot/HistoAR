/**
 * materi-loader.js
 * Ambil data/materi.json dan render:
 * - grid kartu materi (materi.html) dengan status lock/unlock
 * - konten detail satu materi (materi-detail.html)
 */

async function fetchMateri() {
  const res = await fetch("data/materi.json");
  if (!res.ok) throw new Error("Gagal memuat materi.json");
  const data = await res.json();
  return [...data.materi].sort((a, b) => a.urutan - b.urutan);
}

async function renderMateriGrid() {
  const grid = document.getElementById("materiGrid");
  if (!grid) return;

  try {
    const list = await fetchMateri();
    const { HistoarProgress } = window;
    grid.innerHTML = "";

    list.forEach((m) => {
      const unlocked = HistoarProgress.isMateriUnlocked(list, m.id);
      const done = HistoarProgress.isMateriComplete(m.id);

      const card = document.createElement(unlocked ? "a" : "div");
      card.className = "materi-card" + (unlocked ? "" : " is-locked");
      card.style.setProperty("--layer-color", m.layerColor);
      if (unlocked) card.href = `materi-detail.html?id=${m.id}`;

      const statusText = done ? "✓ Selesai" : unlocked ? "📷 Scan AR" : "🔒 Terkunci";
      const statusClass = unlocked ? "" : "locked";

      card.innerHTML = `
        <span class="materi-card__code mono">${m.kode}</span>
        <h3 class="materi-card__title">${m.judul}</h3>
        <p>${m.ringkasan}</p>
        <span class="materi-card__status ${statusClass}">${statusText}</span>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p>Gagal memuat daftar materi. Coba muat ulang halaman.</p>`;
  }
}

async function renderMateriDetail() {
  const container = document.getElementById("materiDetailBody");
  if (!container) return;

  const id = window.HistoarRouter.getQueryParam("id");
  try {
    const list = await fetchMateri();
    const materi = list.find((m) => m.id === id);

    if (!materi) {
      container.innerHTML = `<p>Materi tidak ditemukan. <a href="materi.html">Kembali ke daftar materi</a>.</p>`;
      return;
    }

    if (!window.HistoarProgress.isMateriUnlocked(list, materi.id)) {
      container.innerHTML = `<p>Materi ini masih terkunci. Selesaikan materi sebelumnya dulu ya. <a href="materi.html">Kembali ke daftar materi</a>.</p>`;
      return;
    }

    document.title = `${materi.judul} — Histoar`;
    const eyebrow = document.getElementById("materiEyebrow");
    const heading = document.getElementById("materiHeading");
    if (eyebrow) eyebrow.textContent = materi.kode;
    if (heading) heading.textContent = materi.judul;

    container.innerHTML = materi.konten
      .map(
        (blok) => `
        <div class="materi-detail__section">
          <h3>${blok.judul}</h3>
          <p>${blok.isi}</p>
        </div>`
      )
      .join("");

    const nextBtn = document.getElementById("btnKeQuiz");
    if (nextBtn) nextBtn.href = `hasil-quiz.html?id=${materi.id}`;

    window.HistoarRouter.renderCoreSample(materi.id);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p>Gagal memuat materi. Coba muat ulang halaman.</p>`;
  }
}

window.HistoarMateriLoader = { fetchMateri, renderMateriGrid, renderMateriDetail };
