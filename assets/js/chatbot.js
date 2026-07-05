/**
 * chatbot.js
 * Tanggung jawab: render UI chat HistoAI, kirim pesan, tandai "sudah dipakai".
 * Belum connect ke API/LLM beneran — respons masih scripted berbasis skor.
 * Nanti tinggal ganti isi generateResponse() dengan fetch ke endpoint LLM.
 */

class Chatbot {
  /**
   * @param {Object} elements - { log, input, sendBtn }
   * @param {Object} context - { materiJudul, score, total }
   * @param {Function} onFirstInteraction - dipanggil sekali begitu siswa kirim pesan pertama
   */
  constructor(elements, context, onFirstInteraction) {
    this.el = elements;
    this.context = context;
    this.onFirstInteraction = onFirstInteraction;
    this.hasInteracted = false;

    this.el.sendBtn.addEventListener("click", () => this.handleSend());
    this.el.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSend();
    });
  }

  init() {
    const { score, total, materiJudul } = this.context;
    const pembuka =
      score === total
        ? `Mantap, nilai kamu sempurna (${score}/${total}) di materi "${materiJudul}"! Ada yang mau didiskusikan lebih lanjut?`
        : `Kamu dapat skor ${score}/${total} di materi "${materiJudul}". Mau bahas soal yang masih kurang pas, atau nanya hal lain soal materi ini?`;
    this.addMessage("bot", pembuka);
  }

  addMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-msg ${role}`;
    bubble.textContent = text;
    this.el.log.appendChild(bubble);
    this.el.log.scrollTop = this.el.log.scrollHeight;
  }

  handleSend() {
    const text = this.el.input.value.trim();
    if (!text) return;

    this.addMessage("user", text);
    this.el.input.value = "";

    if (!this.hasInteracted) {
      this.hasInteracted = true;
      this.onFirstInteraction();
    }

    // Placeholder: nanti diganti pemanggilan API LLM beneran.
    const reply = this.generateResponse(text);
    setTimeout(() => this.addMessage("bot", reply), 400);
  }

  generateResponse(userText) {
    return `Catatan diterima: "${userText}". (Respons HistoAI masih placeholder — sambungkan ke API LLM di sini menggunakan context materi "${this.context.materiJudul}".)`;
  }
}

window.Chatbot = Chatbot;
