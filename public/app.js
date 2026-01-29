const $ = (sel) => document.querySelector(sel);

const form = $('#searchForm');
const input = $('#query');
const caseSensitiveEl = $('#caseSensitive');
const statusEl = $('#status');
const resultsEl = $('#results');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, query, caseSensitive) {
  if (!query) return escapeHtml(text);
  const q = escapeRegExp(query);
  const flags = caseSensitive ? 'g' : 'gi';
  const re = new RegExp(q, flags);
  return escapeHtml(text).replace(re, (m) => `<mark>${m}</mark>`);
}

function docIconSvg() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" opacity=".18"/>
      <path d="M14 3v3h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 10h8M8 14h8M8 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

async function health() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.hasManifest) {
      statusEl.textContent = `Dataset siap: ${data.totalDocs} dokumen. (${data.generatedAt ? 'build: ' + new Date(data.generatedAt).toLocaleString() : 'belum ada timestamp'})`;
    } else {
      statusEl.textContent = 'Dataset belum dibangun. Jalankan: npm run build:data';
    }
  } catch (e) {
    statusEl.textContent = 'Gagal memuat status dataset.';
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    statusEl.textContent = 'Mencari...';
    resultsEl.innerHTML = '';
  }
}

function renderResults(payload) {
  const { results, matchedDocs, totalDocs, tookMs, query, caseSensitive } = payload;

  statusEl.textContent = `Kata kunci: "${query}" • Ditemukan ${matchedDocs} dari ${totalDocs} dokumen • Waktu: ${tookMs} ms`;

  if (!results || results.length === 0) {
    resultsEl.innerHTML = `
      <div class="result">
        <div class="result__icon">${docIconSvg()}</div>
        <div class="result__main">
          <p class="result__title">Tidak ada hasil.</p>
          <p class="result__snippet">Coba kata kunci lain atau pastikan dataset sudah diekstrak.</p>
        </div>
      </div>
    `;
    return;
  }

  resultsEl.innerHTML = results.map((r) => {
    const snippets = (r.snippets || []).map((s) => {
      const html = highlight(s.preview, query, caseSensitive);
      return `<p class="result__snippet">${html}</p>`;
    }).join('');

    return `
      <article class="result">
        <div class="result__icon">${docIconSvg()}</div>
        <div class="result__main">
          <h3 class="result__title">
            <span>${escapeHtml(r.title || 'Dokumen')}</span>
            <span class="result__file">${escapeHtml(r.pdfFileName || '')}</span>
            <span class="result__badge">${r.count} match</span>
          </h3>
          ${snippets}
        </div>
      </article>
    `;
  }).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  const caseSensitive = caseSensitiveEl.checked;

  if (!query) {
    statusEl.textContent = 'Masukkan kata kunci terlebih dahulu.';
    return;
  }

  setLoading(true);

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, caseSensitive })
    });

    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = data?.error || 'Terjadi kesalahan saat mencari.';
      resultsEl.innerHTML = '';
      return;
    }

    renderResults(data);
  } catch (err) {
    statusEl.textContent = 'Gagal terhubung ke server.';
  }
});

health();
