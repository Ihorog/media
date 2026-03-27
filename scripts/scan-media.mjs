#!/usr/bin/env node
/**
 * scan-media.mjs
 * Scans the repository for image files (jpg/jpeg/png/webp/gif/heic),
 * computes SHA-256 hashes, reports duplicates, and writes
 * ops/STRUCTURE_STATE.json.
 *
 * Usage: node scripts/scan-media.mjs [--exclude-assets]
 */
import { createHash } from 'crypto';
import { createReadStream, readdirSync, statSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']);
const INDEX_PATH = join(ROOT, 'index', 'images.jsonl');
const STATE_PATH = join(ROOT, 'ops', 'STRUCTURE_STATE.json');

const args = process.argv.slice(2);
const excludeAssets = args.includes('--exclude-assets');

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
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
      if (entry === 'node_modules' || entry === 'dist') continue;
      if (excludeAssets && fullPath === join(ROOT, 'assets')) continue;
      walkDir(fullPath, results);
    } else if (IMAGE_EXTS.has(extname(entry).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function loadIndex() {
  const indexed = new Set();
  if (!existsSync(INDEX_PATH)) return indexed;
  const lines = readFileSync(INDEX_PATH, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      if (record.id) indexed.add(record.id);
    } catch {
      // skip malformed lines
    }
  }
  return indexed;
}

async function main() {
  console.log('Scanning repository for image files…');
  const files = walkDir(ROOT);
  console.log(`Found ${files.length} image file(s).`);

  const hashMap = new Map(); // hex → [paths]
  const errors = [];

  for (const file of files) {
    try {
      const hex = await sha256File(file);
      const relPath = relative(ROOT, file);
      if (!hashMap.has(hex)) hashMap.set(hex, []);
      hashMap.get(hex).push(relPath);
    } catch (err) {
      errors.push({ file: relative(ROOT, file), error: err.message });
    }
  }

  const indexed = loadIndex();
  const unindexed = [];
  const duplicateGroups = [];

  for (const [hex, paths] of hashMap) {
    const id = `sha256:${hex}`;
    if (!indexed.has(id)) {
      unindexed.push(...paths);
    }
    if (paths.length > 1) {
      duplicateGroups.push({ id, paths });
    }
  }

  const state = {
    generated_at: new Date().toISOString(),
    total_image_files: files.length,
    indexed_assets: indexed.size,
    unindexed_files: unindexed,
    duplicate_groups: duplicateGroups,
    errors,
  };

  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  console.log(`✓ State written to ops/STRUCTURE_STATE.json`);

  if (duplicateGroups.length > 0) {
    console.warn(`⚠ ${duplicateGroups.length} duplicate group(s) detected.`);
    for (const g of duplicateGroups) {
      console.warn(`  ${g.id}: ${g.paths.join(', ')}`);
    }
  }
  if (unindexed.length > 0) {
    console.log(`ℹ ${unindexed.length} image file(s) not yet in index.`);
  }
  if (errors.length > 0) {
    console.error(`✗ ${errors.length} error(s) encountered.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
