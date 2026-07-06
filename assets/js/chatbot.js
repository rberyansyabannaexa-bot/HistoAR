class Chatbot {
  constructor(elements, context, onFirstInteraction) {
    this.el = elements;
    this.context = context; // sekarang wajib punya: materiId, materiJudul, score, total
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

  async handleSend() {
    const text = this.el.input.value.trim();
    if (!text) return;
    this.addMessage("user", text);
    this.el.input.value = "";

    if (!this.hasInteracted) {
      this.hasInteracted = true;
      this.onFirstInteraction();
    }

    this.addMessage("bot", "Mengetik...");
    const reply = await this.generateResponse(text);
    this.el.log.lastChild.remove(); // hapus "Mengetik..."
    this.addMessage("bot", reply);
  }

  async generateResponse(userText) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materi_id: this.context.materiId,
          pertanyaan: userText,
        }),
      });
      const data = await res.json();
      return data.jawaban || "Maaf, terjadi kesalahan. Coba lagi ya.";
    } catch (err) {
      console.error(err);
      return "Maaf, HistoAI sedang tidak bisa dihubungi. Coba beberapa saat lagi.";
    }
  }
}
window.Chatbot = Chatbot;
