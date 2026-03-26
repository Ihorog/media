#!/usr/bin/env node
/**
 * ingest-images.mjs
 * Takes a source directory, computes SHA-256 for each image, copies (or moves)
 * files into canonical assets/img/<YYYY>/<MM>/sha256:<hex>.<ext>, and appends
 * records to index/images.jsonl.
 *
 * Usage:
 *   node scripts/ingest-images.mjs --source <dir> [--move] [--source-label <label>]
 *
 * Options:
 *   --source <dir>          Directory containing images to ingest (required)
 *   --move                  Move files instead of copying (default: copy)
 *   --source-label <label>  Source label written to record (default: iphone)
 */
import { createHash } from 'crypto';
import {
  createReadStream,
  readdirSync,
  statSync,
  mkdirSync,
  copyFileSync,
  renameSync,
  existsSync,
  readFileSync,
  appendFileSync,
} from 'fs';
import { join, extname, basename, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const INDEX_PATH = join(ROOT, 'index', 'images.jsonl');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']);

const MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
};

// Parse CLI args
const args = process.argv.slice(2);
let sourceDir = null;
let moveFiles = false;
let sourceLabel = 'iphone';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source' && args[i + 1]) sourceDir = args[++i];
  else if (args[i] === '--move') moveFiles = true;
  else if (args[i] === '--source-label' && args[i + 1]) sourceLabel = args[++i];
}

if (!sourceDir) {
  console.error('Usage: node scripts/ingest-images.mjs --source <dir> [--move] [--source-label <label>]');
  process.exit(1);
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function loadIndexedIds() {
  const ids = new Set();
  if (!existsSync(INDEX_PATH)) return ids;
  const lines = readFileSync(INDEX_PATH, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      if (r.id) ids.add(r.id);
    } catch {
      // skip
    }
  }
  return ids;
}

function walkDir(dir, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkDir(fullPath, results);
    } else if (IMAGE_EXTS.has(extname(entry).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const absSource = join(process.cwd(), sourceDir);
  if (!existsSync(absSource)) {
    console.error(`Source directory not found: ${absSource}`);
    process.exit(1);
  }

  const files = walkDir(absSource);
  console.log(`Found ${files.length} image file(s) in ${absSource}`);

  const indexedIds = loadIndexedIds();
  let ingested = 0;
  let skipped = 0;

  for (const srcFile of files) {
    const hex = await sha256File(srcFile);
    const id = `sha256:${hex}`;

    if (indexedIds.has(id)) {
      console.log(`  skip (already indexed): ${basename(srcFile)}`);
      skipped++;
      continue;
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = extname(srcFile).toLowerCase().replace('.', '');
    const canonicalName = `sha256:${hex}.${ext}`;
    const destDir = join(ROOT, 'assets', 'img', yyyy, mm);
    mkdirSync(destDir, { recursive: true });
    const destFile = join(destDir, canonicalName);

    if (!existsSync(destFile)) {
      if (moveFiles) {
        renameSync(srcFile, destFile);
        console.log(`  moved → ${relative(ROOT, destFile)}`);
      } else {
        copyFileSync(srcFile, destFile);
        console.log(`  copied → ${relative(ROOT, destFile)}`);
      }
    }

    const record = {
      id,
      path: relative(ROOT, destFile).replace(/\\/g, '/'),
      ext,
      mime: MIME_MAP[ext] || `image/${ext}`,
      source: sourceLabel,
      origin_path: relative(process.cwd(), srcFile).replace(/\\/g, '/'),
      created_at: now.toISOString(),
    };

    appendFileSync(INDEX_PATH, JSON.stringify(record) + '\n', 'utf8');
    indexedIds.add(id);
    ingested++;
  }

  console.log(`✓ Ingested: ${ingested}, Skipped (duplicates): ${skipped}`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
