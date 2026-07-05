/**
 * router.js
 * Helper navigasi ringan + render "core sample" (signature progress bar)
 * yang dipakai bareng di semua halaman.
 */

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function goTo(url) {
  window.location.href = url;
}

/**
 * Render core-sample di dalam elemen dengan id "coreSample".
 * Tiap materi jadi satu "layer". Layer terisi warna kalau sudah selesai,
 * berkedip pelan kalau itu materi yang sedang berjalan.
 */
async function renderCoreSample(currentMateriId) {
  const el = document.getElementById("coreSample");
  if (!el) return;

  try {
    const res = await fetch("data/materi.json");
    const data = await res.json();
    const list = [...data.materi].sort((a, b) => a.urutan - b.urutan);
    const progress = window.HistoarProgress.getProgress();

    el.innerHTML = "";
    list.forEach((m) => {
      const layer = document.createElement("span");
      layer.className = "core-sample__layer";
      layer.style.setProperty("--layer-color", m.layerColor);
      layer.title = `${m.kode} — ${m.judul}`;

      if (progress.completed.includes(m.id)) {
        layer.classList.add("is-done");
      } else if (m.id === currentMateriId) {
        layer.classList.add("is-current");
      }
      el.appendChild(layer);
    });
  } catch (err) {
    console.error("Gagal memuat core sample:", err);
  }
}

window.HistoarRouter = { getQueryParam, goTo, renderCoreSample };
