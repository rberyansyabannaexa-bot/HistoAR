import materiData from "../data/materi.json";

const API_URL = "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions";

function cariMateri(id) {
  return materiData.materi.find((m) => m.id === id);
}

function buatPrompt(judul, konteks, pertanyaan) {
  return `Kamu adalah HistoAI, asisten belajar sejarah untuk siswa SMA.

ATURAN:
1. Jawab HANYA berdasarkan materi berikut.
2. Jangan menggunakan informasi di luar materi.
3. Jika pertanyaan di luar materi, jawab PERSIS:
"Mohon maaf, pertanyaan yang anda ajukan diluar konteks dari materi ini"

====================
Judul Materi:
${judul}

Materi:
${konteks}

====================

Pertanyaan:
${pertanyaan}
`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    const { materi_id, pertanyaan } = req.body;

    if (!pertanyaan) {
      return res.status(400).json({
        error: "Pertanyaan kosong",
      });
    }

    const materi = cariMateri(materi_id);

    if (!materi) {
      return res.status(400).json({
        error: "Materi tidak ditemukan",
      });
    }

    const prompt = buatPrompt(
      materi.judul,
      materi.ringkasan,
      pertanyaan
    );

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KIE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const json = await response.json();

    console.log(json);

    if (!response.ok) {
      return res.status(response.status).json(json);
    }

    const reply =
      json.choices?.[0]?.message?.content ??
      "Maaf, tidak ada balasan dari AI.";

    return res.json({
      reply,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
