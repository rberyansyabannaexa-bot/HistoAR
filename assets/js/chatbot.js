class Chatbot {
  constructor(elements, context, onFirstInteraction) {
    this.el = elements;
    this.context = context;
    this.onFirstInteraction = onFirstInteraction;
    this.hasInteracted = false;

    this.el.sendBtn.addEventListener("click", () => this.handleSend());

    this.el.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleSend();
      }
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

    return bubble;
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

    this.el.sendBtn.disabled = true;
    this.el.input.disabled = true;

    const bubble = this.addMessage("bot", "...");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          materi_id: this.context.materiId,
          pertanyaan: text,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        bubble.textContent =
          json.error?.message ||
          json.error ||
          "Terjadi kesalahan.";
        return;
      }

      bubble.textContent = json.reply;
    } catch (err) {
      console.error(err);
      bubble.textContent = "Tidak dapat menghubungi server.";
    } finally {
      this.el.sendBtn.disabled = false;
      this.el.input.disabled = false;
      this.el.input.focus();
    }
  }
}

window.Chatbot = Chatbot;
