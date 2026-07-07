import materiData from "../data/materi.json";

const API_URL = "https://gateway.dahono.com/v1/chat/completions";

function cariMateri(id) {
  return materiData.materi.find((m) => m.id === id);
}

function buatPrompt(judul, konteks, pertanyaan) {
  return `Kamu adalah HistoAI, asisten belajar sejarah SMA.

ATURAN:
1. Jawab HANYA berdasarkan materi berikut.
2. Jika pertanyaan di luar materi, balas:
"Mohon maaf, pertanyaan yang anda ajukan diluar konteks dari materi ini"

Judul:
${judul}

Materi:
${konteks}

Pertanyaan:
${pertanyaan}`;
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

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DAHONO_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dahono/deepseek-v3.2",
        messages: [
          {
            role: "user",
            content: buatPrompt(
              materi.judul,
              materi.ringkasan,
              pertanyaan
            ),
          },
        ],
      }),
    });

    const json = await response.json();

    console.log(json);

    if (!response.ok) {
      return res.status(response.status).json(json);
    }

    return res.json({
      reply: json.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
