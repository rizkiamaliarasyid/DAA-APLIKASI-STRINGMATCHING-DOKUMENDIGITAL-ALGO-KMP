const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const express = require('express');

const { kmpSearchAll } = require('./algorithms/kmp');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public')));

function escapeForJson(str) {
  // data snippet akan di-escape di frontend sebelum jadi HTML,
  // jadi di server cukup pastikan ini string.
  return typeof str === 'string' ? str : '';
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

async function loadManifest() {
  try {
    const raw = await fsp.readFile(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const docs = Array.isArray(parsed.documents) ? parsed.documents : [];
    return { ok: true, documents: docs, generatedAt: parsed.generatedAt || null };
  } catch (e) {
    return { ok: false, documents: [], error: e.message };
  }
}

function makeSnippets(text, positions, patternLength, limit = 3) {
  const snippets = [];
  const radius = 70; // chars around match

  for (let i = 0; i < positions.length && snippets.length < limit; i++) {
    const pos = positions[i];
    const start = Math.max(0, pos - radius);
    const end = Math.min(text.length, pos + patternLength + radius);

    const raw = text.slice(start, end);
    const clean = normalizeWhitespace(raw);

    snippets.push({
      start,
      end,
      preview: escapeForJson(clean)
    });
  }

  return snippets;
}

app.get('/api/health', async (req, res) => {
  const manifest = await loadManifest();
  res.json({
    ok: true,
    hasManifest: manifest.ok,
    totalDocs: manifest.documents.length,
    generatedAt: manifest.generatedAt || null,
    message: manifest.ok ? 'Dataset siap.' : 'Manifest tidak ditemukan. Jalankan: npm run build:data'
  });
});

app.post('/api/search', async (req, res) => {
  const t0 = process.hrtime.bigint();

  const query = String(req.body?.query || '').trim();
  const caseSensitive = Boolean(req.body?.caseSensitive);

  if (!query) {
    return res.status(400).json({
      ok: false,
      error: 'Kata kunci kosong. Silakan isi kata kunci.'
    });
  }

  const manifest = await loadManifest();
  if (!manifest.ok) {
    return res.status(400).json({
      ok: false,
      error: 'Dataset belum dibangun. Jalankan: npm run build:data'
    });
  }

  const maxPositions = 12; // simpan posisi match awal saja untuk snippet

  const results = [];

  for (const doc of manifest.documents) {
    const textFile = path.join(ROOT, doc.textPath);

    let text;
    try {
      text = await fsp.readFile(textFile, 'utf8');
    } catch (e) {
      // Kalau file text hilang, skip
      continue;
    }

    const searchText = caseSensitive ? text : text.toLowerCase();
    const pattern = caseSensitive ? query : query.toLowerCase();

    const { count, positions } = kmpSearchAll(searchText, pattern, { maxPositions });
    if (count > 0) {
      const snippets = makeSnippets(text, positions, query.length, 3);
      results.push({
        id: doc.id,
        title: doc.title,
        pdfFileName: doc.pdfFileName,
        count,
        snippets
      });
    }
  }

  // sort by most matches
  results.sort((a, b) => b.count - a.count);

  const t1 = process.hrtime.bigint();
  const tookMs = Number(t1 - t0) / 1e6;

  res.json({
    ok: true,
    query,
    caseSensitive,
    totalDocs: manifest.documents.length,
    matchedDocs: results.length,
    tookMs: Math.round(tookMs * 100) / 100,
    results
  });
});

app.listen(PORT, () => {
  console.log(`CariPDF (KMP) berjalan di http://localhost:${PORT}`);
  console.log('Jika dataset belum ada: npm run build:data');
});
