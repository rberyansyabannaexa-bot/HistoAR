# Histoar

Media belajar interaktif tentang prasejarah Nusantara — materi, quiz, dan diskusi bareng **HistoAI**.

## Cara menjalankan

Karena halaman ini fetch file JSON (`data/materi.json`, `data/quiz.json`), buka lewat local server, bukan langsung double-click file HTML (browser akan memblokir fetch dari `file://`).

Pakai salah satu:

```bash
# Python
cd histoar
python3 -m http.server 8000

# atau Node
npx serve histoar
```

Lalu buka `http://localhost:8000`.

## Struktur proyek

```
histoar/
├── index.html            # Home + Prolog
├── materi.html            # Grid pilihan materi (lock/unlock)
├── materi-detail.html     # Konten satu materi
├── hasil-quiz.html        # Quiz -> Hasil -> HistoAI (1 halaman, state-based)
│
├── assets/
│   ├── css/
│   │   ├── main.css        # Design tokens (warna, tipografi, layout dasar)
│   │   └── components.css  # Komponen (kartu materi, quiz, chat, dst)
│   ├── js/
│   │   ├── router.js          # Helper URL param + render "core sample"
│   │   ├── progress.js        # localStorage: materi selesai & unlock berikutnya
│   │   ├── materi-loader.js   # Render grid & detail dari materi.json
│   │   ├── quiz-engine.js     # Render soal, validasi jawaban, hitung skor
│   │   ├── chatbot.js         # UI chat HistoAI (masih scripted, siap disambung API)
│   │   └── quiz-controller.js # Orchestrator: quiz -> hasil -> chatbot -> gating
│   ├── img/
│   ├── audio/              # nanti voice narator
│   └── models/             # nanti asset AR
│
├── data/
│   ├── materi.json          # Single source of truth semua materi
│   └── quiz.json            # Soal quiz per materi
│
└── README.md
```

## Alur belajar

1. Siswa buka `materi.html`, pilih materi yang terbuka (locked kalau materi sebelumnya belum selesai).
2. Baca konten di `materi-detail.html`, lalu klik "Kerjakan Quiz".
3. Di `hasil-quiz.html`: kerjakan quiz → otomatis muncul hasil skor → section HistoAI muncul.
4. Tombol "Lanjut ke Materi Berikutnya" ter-disable sampai siswa mengirim minimal satu pesan ke HistoAI (gating).
5. Progres tersimpan di `localStorage` (lihat `progress.js`), dipakai untuk unlock materi berikutnya dan render "core sample" (progress bar bergaya sampel bor tanah) di header.

## Konsep desain

Tema visual mengikuti stratigrafi (lapisan tanah arkeologi):

- **Warna**: basalt gelap sebagai latar, aksen rust ochre (oksida besi) dan moss (vegetasi).
- **Tipografi**: Fraunces (display/judul), Inter (body), IBM Plex Mono (kode materi, skor, label data).
- **Signature element**: "core sample" — strip vertikal berlapis di header yang merepresentasikan progres belajar, tiap materi = satu lapisan.

## Belum terhubung / TODO

- `chatbot.js` → `generateResponse()` masih placeholder. Sambungkan ke API LLM sungguhan di sana (kirim context: `materiJudul`, `score`, `total`, dan pesan siswa).
- Asset `audio/` (narator suara) dan `models/` (AR) masih kosong, disiapkan untuk pengembangan berikutnya.
- Belum ada halaman admin/CMS untuk edit materi — saat ini edit langsung di `data/materi.json` & `data/quiz.json`.
