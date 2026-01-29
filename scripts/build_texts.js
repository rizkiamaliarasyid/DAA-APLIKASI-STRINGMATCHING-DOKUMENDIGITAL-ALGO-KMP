#!/usr/bin/env node

/**
 * Build dataset:
 * - Scan data/pdfs/*.pdf
 * - Convert to data/texts/*.txt using pdftotext
 * - Produce data/manifest.json
 *
 * Requirements:
 * - Poppler 'pdftotext' must be installed OR set env PDFTOTEXT_PATH to full path.
 *   Example Windows:
 *     $env:PDFTOTEXT_PATH = "C:\\poppler\\Library\\bin\\pdftotext.exe"
 *
 * Run:
 *   npm run build:data
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'data', 'pdfs');
const TXT_DIR = path.join(ROOT, 'data', 'texts');
const MANIFEST_PATH = path.join(ROOT, 'data', 'manifest.json');

const PDFTOTEXT = process.env.PDFTOTEXT_PATH || 'pdftotext';
const COMMON_ARGS = ['-enc', 'UTF-8', '-layout'];

function sha1(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function runPdftotext(inputPdf, outputTxt) {
  return new Promise((resolve, reject) => {
    const args = [...COMMON_ARGS, inputPdf, outputTxt];

    const child = spawn(PDFTOTEXT, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (d) => (stderr += String(d)));

    child.on('error', (err) => {
      // ENOENT biasanya artinya executable tidak ditemukan
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`pdftotext exit code ${code}: ${stderr.trim()}`));
    });
  });
}

async function main() {
  await ensureDir(PDF_DIR);
  await ensureDir(TXT_DIR);

  const files = (await fsp.readdir(PDF_DIR)).filter((f) => f.toLowerCase().endsWith('.pdf'));

  console.log(`Ditemukan ${files.length} file PDF di ${PDF_DIR}`);
  if (files.length === 0) {
    console.log('Taruh PDF kamu ke folder data/pdfs lalu jalankan lagi: npm run build:data');
    process.exit(0);
  }

  const manifest = [];

  for (let idx = 0; idx < files.length; idx++) {
    const fileName = files[idx];
    const pdfPath = path.join(PDF_DIR, fileName);

    const stat = await fsp.stat(pdfPath);
    const id = sha1(`${fileName}|${stat.size}|${stat.mtimeMs}`).slice(0, 12);
    const outName = `${id}.txt`;
    const txtPath = path.join(TXT_DIR, outName);

    process.stdout.write(`[${idx + 1}/${files.length}] Ekstrak: ${fileName} ... `);

    try {
      await runPdftotext(pdfPath, txtPath);
      console.log('OK');

      manifest.push({
        id,
        title: path.parse(fileName).name,
        pdfFileName: fileName,
        pdfPath: path.relative(ROOT, pdfPath).replace(/\\/g, '/'),
        textPath: path.relative(ROOT, txtPath).replace(/\\/g, '/'),
        bytes: stat.size,
        updatedAt: new Date(stat.mtimeMs).toISOString()
      });
    } catch (err) {
      console.log('GAGAL');
      console.log(`  -> ${err.message}`);
      console.log('  -> Lewati file ini, lanjut ke file berikutnya.');
    }
  }

  await fsp.writeFile(MANIFEST_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: manifest.length,
    documents: manifest
  }, null, 2));

  console.log(`\nSelesai. Manifest: ${MANIFEST_PATH}`);
  console.log(`Dokumen berhasil diekstrak: ${manifest.length}/${files.length}`);

  if (manifest.length === 0) {
    console.log('\nCATATAN: Tidak ada PDF yang berhasil diekstrak.');
    console.log('Pastikan pdftotext terinstal, atau set PDFTOTEXT_PATH.');
    console.log('Contoh Windows (PowerShell):');
    console.log('  $env:PDFTOTEXT_PATH = "C:\\poppler\\Library\\bin\\pdftotext.exe"');
  }
}

main().catch((e) => {
  console.error('Build data gagal:', e);
  process.exit(1);
});
