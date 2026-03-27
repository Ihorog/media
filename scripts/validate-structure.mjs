#!/usr/bin/env node
/**
 * validate-structure.mjs
 * Validates the integrity of the asset registry:
 *   1. Every images.jsonl record path exists on disk.
 *   2. No duplicate ids in images.jsonl.
 *   3. Canonical path naming rules (assets/img/YYYY/MM/sha256:<hex>.<ext>).
 *   4. Derived indexes (tags.json, albums.json) are consistent with images.jsonl.
 *
 * Exits with code 0 on success, non-zero on failure.
 *
 * Usage: node scripts/validate-structure.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const INDEX_PATH = join(ROOT, 'index', 'images.jsonl');
const TAGS_PATH = join(ROOT, 'index', 'tags.json');
const ALBUMS_PATH = join(ROOT, 'index', 'albums.json');

// Matches: assets/img/YYYY/MM/sha256:<64hexchars>.<ext>
const CANONICAL_PATH_RE = /^assets\/img\/\d{4}\/\d{2}\/sha256:[0-9a-f]{64}\.[a-z0-9]+$/;

let failures = 0;

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failures++;
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function main() {
  console.log('Validating structure…\n');

  // ── 1. images.jsonl exists ────────────────────────────────────────────────
  if (!existsSync(INDEX_PATH)) {
    fail('index/images.jsonl not found');
    process.exit(1);
  }

  const lines = readFileSync(INDEX_PATH, 'utf8').split('\n').filter(Boolean);
  const records = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      records.push(JSON.parse(lines[i]));
    } catch {
      fail(`images.jsonl line ${i + 1}: invalid JSON`);
    }
  }

  pass(`images.jsonl parsed — ${records.length} record(s)`);

  // ── 2. No duplicate ids ───────────────────────────────────────────────────
  const seenIds = new Set();
  let sectionFails = 0;
  for (const rec of records) {
    if (!rec.id) {
      fail(`record missing 'id': ${JSON.stringify(rec).slice(0, 80)}`);
      sectionFails++;
      continue;
    }
    if (seenIds.has(rec.id)) {
      fail(`duplicate id: ${rec.id}`);
      sectionFails++;
    } else {
      seenIds.add(rec.id);
    }
  }
  if (sectionFails === 0) pass('no duplicate ids');

  // ── 3. Every path exists on disk ─────────────────────────────────────────
  sectionFails = 0;
  for (const rec of records) {
    if (!rec.path) {
      fail(`record ${rec.id} missing 'path'`);
      sectionFails++;
      continue;
    }
    const abs = join(ROOT, rec.path);
    if (!existsSync(abs)) {
      fail(`path not found on disk: ${rec.path} (id=${rec.id})`);
      sectionFails++;
    }
  }
  if (sectionFails === 0) pass('all record paths exist on disk');

  // ── 4. Canonical path naming rules ───────────────────────────────────────
  sectionFails = 0;
  for (const rec of records) {
    if (!rec.path) continue;
    const normalised = rec.path.replace(/\\/g, '/');
    if (!CANONICAL_PATH_RE.test(normalised)) {
      fail(`non-canonical path: ${rec.path} (id=${rec.id})`);
      sectionFails++;
    }
  }
  if (sectionFails === 0) pass('all paths follow canonical naming rules');

  // ── 5. Derived indexes consistency ───────────────────────────────────────
  // Build expected derived indexes from records
  const expectedTags = {};
  const expectedAlbums = {};
  for (const rec of records) {
    if (Array.isArray(rec.tags)) {
      for (const tag of rec.tags) {
        if (!expectedTags[tag]) expectedTags[tag] = [];
        if (!expectedTags[tag].includes(rec.id)) expectedTags[tag].push(rec.id);
      }
    }
    if (rec.album) {
      if (!expectedAlbums[rec.album]) expectedAlbums[rec.album] = [];
      if (!expectedAlbums[rec.album].includes(rec.id)) expectedAlbums[rec.album].push(rec.id);
    }
  }

  // Compare with tags.json
  if (!existsSync(TAGS_PATH)) {
    fail('index/tags.json not found');
  } else {
    let actualTags;
    try {
      actualTags = JSON.parse(readFileSync(TAGS_PATH, 'utf8'));
    } catch {
      fail('index/tags.json: invalid JSON');
      actualTags = null;
    }
    if (actualTags !== null) {
      const allTagKeys = new Set([...Object.keys(expectedTags), ...Object.keys(actualTags)]);
      for (const tag of allTagKeys) {
        const exp = (expectedTags[tag] || []).slice().sort().join(',');
        const act = (actualTags[tag] || []).slice().sort().join(',');
        if (exp !== act) {
          fail(`tags.json mismatch for tag "${tag}": expected [${exp}] got [${act}]`);
        }
      }
      if (failures === 0) pass('index/tags.json is consistent');
    }
  }

  // Compare with albums.json
  if (!existsSync(ALBUMS_PATH)) {
    fail('index/albums.json not found');
  } else {
    let actualAlbums;
    try {
      actualAlbums = JSON.parse(readFileSync(ALBUMS_PATH, 'utf8'));
    } catch {
      fail('index/albums.json: invalid JSON');
      actualAlbums = null;
    }
    if (actualAlbums !== null) {
      const allAlbumKeys = new Set([...Object.keys(expectedAlbums), ...Object.keys(actualAlbums)]);
      for (const album of allAlbumKeys) {
        const exp = (expectedAlbums[album] || []).slice().sort().join(',');
        const act = (actualAlbums[album] || []).slice().sort().join(',');
        if (exp !== act) {
          fail(`albums.json mismatch for album "${album}": expected [${exp}] got [${act}]`);
        }
      }
      if (failures === 0) pass('index/albums.json is consistent');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  if (failures === 0) {
    console.log('✓ All checks passed.');
  } else {
    console.error(`✗ ${failures} check(s) failed.`);
    process.exit(1);
  }
}

main();
