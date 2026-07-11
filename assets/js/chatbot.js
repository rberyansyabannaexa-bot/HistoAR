/**
 * Escape HTML lalu ubah markdown ringan (bold/italic/newline) jadi tag aman.
 * Dipakai supaya balasan bot yang mengandung **tebal** atau *miring*
 * tidak muncul mentah dengan tanda bintang di chat bubble.
 */
function renderMarkdownLite(text) {
  const escapeHtml = (str) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let safe = escapeHtml(text);

  // Bold: **teks** atau __teks__
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic: *teks* atau _teks_ (dijalankan setelah bold biar gak bentrok)
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  safe = safe.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Baris baru
  safe = safe.replace(/\n/g, "<br>");

  return safe;
}

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

    // Chip saran pertanyaan cepat (opsional, hanya aktif kalau ada di DOM)
    const panel = this.el.input.closest(".chat-panel");
    this.suggestionsEl = panel ? panel.querySelector(".chat-suggestions") : null;
    if (this.suggestionsEl) {
      this.suggestionsEl.querySelectorAll(".chat-suggestion").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.el.input.value = btn.textContent.trim();
          this.handleSend();
        });
      });
    }
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
    bubble.innerHTML = renderMarkdownLite(text);

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
      if (this.suggestionsEl) this.suggestionsEl.hidden = true;
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
        bubble.innerHTML = renderMarkdownLite(
          json.error?.message || json.error || "Terjadi kesalahan."
        );
        return;
      }

      bubble.innerHTML = renderMarkdownLite(json.reply);
    } catch (err) {
      console.error(err);
      bubble.innerHTML = renderMarkdownLite("Tidak dapat menghubungi server.");
    } finally {
      this.el.sendBtn.disabled = false;
      this.el.input.disabled = false;
      this.el.input.focus();
    }
  }
}

window.Chatbot = Chatbot;
