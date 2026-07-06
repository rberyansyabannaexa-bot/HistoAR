import materiData from "../data/materi.json";

const API_URL = "https://api.atomesus.com/v1/chat/completions";

function cariMateri(id) {
  return materiData.materi.find((m) => m.id === id);
}

export default async function handler(req, res) {
  console.log("===== CHAT =====");

  try {
    const { materi_id, pertanyaan } = req.body;

    console.log(req.body);

    const materi = cariMateri(materi_id);

    if (!materi) {
      return res.status(400).json({
        error: "Materi tidak ditemukan",
      });
    }

    const prompt = `
Kamu adalah guru sejarah.

Materi:
${materi.ringkasan}

Pertanyaan:
${pertanyaan}
`;

    console.log("Kirim ke Atomesus...");

    const ai = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ATOMESUS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "cipher",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    console.log("STATUS AI:", ai.status);

    const json = await ai.json();

    console.log(json);

    if (!ai.ok) {
      return res.status(ai.status).json(json);
    }

    return res.json({
      reply: json.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
}
