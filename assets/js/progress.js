/**
 * progress.js
 * Menyimpan progres belajar siswa di localStorage:
 * - materi mana yang sudah selesai (quiz + chatbot kelar)
 * - materi berikutnya otomatis ke-unlock
 *
 * Struktur localStorage:
 * histoar_progress = { completed: ["m1", "m2"], scores: { m1: 3 } }
 */

const STORAGE_KEY = "histoar_progress";

function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: [], scores: {} };
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      scores: parsed.scores && typeof parsed.scores === "object" ? parsed.scores : {},
    };
  } catch (err) {
    console.error("Gagal membaca progres:", err);
    return { completed: [], scores: {} };
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error("Gagal menyimpan progres:", err);
  }
}

function markMateriComplete(materiId, score) {
  const progress = getProgress();
  if (!progress.completed.includes(materiId)) {
    progress.completed.push(materiId);
  }
  progress.scores[materiId] = score;
  saveProgress(progress);
  return progress;
}

function isMateriComplete(materiId) {
  return getProgress().completed.includes(materiId);
}

/**
 * Materi ke-N terbuka jika materi ke-(N-1) sudah selesai.
 * Materi pertama (urutan 1) selalu terbuka.
 */
function isMateriUnlocked(materiList, materiId) {
  const sorted = [...materiList].sort((a, b) => a.urutan - b.urutan);
  const idx = sorted.findIndex((m) => m.id === materiId);
  if (idx <= 0) return true;
  const prev = sorted[idx - 1];
  return isMateriComplete(prev.id);
}

function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

window.HistoarProgress = {
  getProgress,
  saveProgress,
  markMateriComplete,
  isMateriComplete,
  isMateriUnlocked,
  resetProgress,
};
