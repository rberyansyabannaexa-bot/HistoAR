/**
 * quiz-engine.js
 * Tanggung jawab: render soal satu per satu, validasi jawaban, hitung skor.
 * Tidak tahu apa-apa soal chatbot — murni logic quiz.
 */

class QuizEngine {
  /**
   * @param {Array} questions - daftar soal [{id, pertanyaan, opsi, jawaban}]
   * @param {Object} elements - referensi DOM { panel, progress, question, options, nextBtn }
   * @param {Function} onFinish - callback(score, total) dipanggil pas soal terakhir dijawab
   */
  constructor(questions, elements, onFinish) {
    this.questions = questions;
    this.el = elements;
    this.onFinish = onFinish;
    this.currentIndex = 0;
    this.score = 0;
    this.answered = false;
  }

  start() {
    this.currentIndex = 0;
    this.score = 0;
    this.renderCurrent();
  }

  renderCurrent() {
    this.answered = false;
    const q = this.questions[this.currentIndex];

    this.el.progress.textContent = `Soal ${this.currentIndex + 1} / ${this.questions.length}`;
    this.el.question.textContent = q.pertanyaan;
    this.el.options.innerHTML = "";
    this.el.nextBtn.disabled = true;
    this.el.nextBtn.textContent =
      this.currentIndex === this.questions.length - 1 ? "Lihat Hasil" : "Lanjut";

    q.opsi.forEach((opsiText, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = opsiText;
      btn.addEventListener("click", () => this.selectAnswer(idx, btn));
      this.el.options.appendChild(btn);
    });
  }

  selectAnswer(selectedIdx, btnEl) {
    if (this.answered) return;
    this.answered = true;

    const q = this.questions[this.currentIndex];
    const isCorrect = selectedIdx === q.jawaban;
    if (isCorrect) this.score += 1;

    [...this.el.options.children].forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.jawaban) btn.classList.add("correct");
      if (idx === selectedIdx && !isCorrect) btn.classList.add("incorrect");
    });

    this.el.nextBtn.disabled = false;
  }

  next() {
    if (!this.answered) return;

    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex += 1;
      this.renderCurrent();
    } else {
      this.onFinish(this.score, this.questions.length);
    }
  }
}

window.QuizEngine = QuizEngine;
