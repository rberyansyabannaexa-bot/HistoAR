/**
 * quiz-controller.js
 * Orchestrator untuk hasil-quiz.html.
 * Alur: ambil ?id= materi -> load soal -> jalankan QuizEngine ->
 * tampilkan hasil -> munculkan Chatbot -> gating tombol "Lanjut" sampai chatbot dipakai.
 */

async function initQuizController() {
  const materiId = window.HistoarRouter.getQueryParam("id");
  if (!materiId) {
    document.getElementById("quizSection").innerHTML =
      '<p>Materi tidak ditentukan. <a href="materi.html">Kembali ke daftar materi</a>.</p>';
    return;
  }

  let materiList, materi, questions;
  try {
    const [materiRes, quizRes] = await Promise.all([
      fetch("data/materi.json").then((r) => r.json()),
      fetch("data/quiz.json").then((r) => r.json()),
    ]);
    materiList = materiRes.materi;
    materi = materiList.find((m) => m.id === materiId);
    questions = quizRes.quiz[materiId];
  } catch (err) {
    console.error(err);
    document.getElementById("quizSection").innerHTML = "<p>Gagal memuat soal quiz.</p>";
    return;
  }

  if (!materi || !questions) {
    document.getElementById("quizSection").innerHTML =
      '<p>Soal untuk materi ini belum tersedia. <a href="materi.html">Kembali ke daftar materi</a>.</p>';
    return;
  }

  window.HistoarRouter.renderCoreSample(materiId);

  const quizSection = document.getElementById("quizSection");
  const resultSection = document.getElementById("resultSection");
  const chatSection = document.getElementById("chatSection");

  const quizElements = {
    progress: document.getElementById("quizProgress"),
    question: document.getElementById("quizQuestion"),
    options: document.getElementById("quizOptions"),
    nextBtn: document.getElementById("quizNextBtn"),
  };

  const engine = new QuizEngine(questions, quizElements, (score, total) => {
    quizSection.hidden = true;
    resultSection.hidden = false;
    showResult(score, total);

    const chatbot = new Chatbot(
      {
        log: document.getElementById("chatLog"),
        input: document.getElementById("chatInput"),
        sendBtn: document.getElementById("chatSendBtn"),
      },
      { materiId, materiJudul: materi.judul, score, total },
      () => {
        // Gating: begitu siswa kirim pesan pertama, buka tombol lanjut materi.
        window.HistoarProgress.markMateriComplete(materiId, score);
        const nextBtn = document.getElementById("btnLanjutMateri");
        if (nextBtn) {
          nextBtn.disabled = false;
          document.getElementById("gateNote").hidden = true;
        }
      }
    );

    chatSection.hidden = false;
    chatbot.init();
  });

  quizElements.nextBtn.addEventListener("click", () => engine.next());
  engine.start();

  function showResult(score, total) {
    document.getElementById("resultScore").textContent = `${score}/${total}`;
    const nextMateri = [...materiList]
      .sort((a, b) => a.urutan - b.urutan)
      .find((m) => m.urutan === materi.urutan + 1);

    const nextBtn = document.getElementById("btnLanjutMateri");
    if (nextBtn) {
      if (nextMateri) {
        nextBtn.href = `materi-detail.html?id=${nextMateri.id}`;
        nextBtn.textContent = `Lanjut ke ${nextMateri.judul} →`;
      } else {
        nextBtn.href = "materi.html";
        nextBtn.textContent = "Semua materi selesai — Kembali ke daftar";
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", initQuizController);
