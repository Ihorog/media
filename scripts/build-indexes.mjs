#!/usr/bin/env node
/**
 * build-indexes.mjs
 * Reads index/images.jsonl and produces:
 *   index/tags.json   — tag → [id, ...]
 *   index/albums.json — album → [id, ...]
 *
 * Usage: node scripts/build-indexes.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const INDEX_PATH = join(ROOT, 'index', 'images.jsonl');
const TAGS_PATH = join(ROOT, 'index', 'tags.json');
const ALBUMS_PATH = join(ROOT, 'index', 'albums.json');

function main() {
  if (!existsSync(INDEX_PATH)) {
    console.error(`index/images.jsonl not found: ${INDEX_PATH}`);
    process.exit(1);
  }

  const lines = readFileSync(INDEX_PATH, 'utf8').split('\n').filter(Boolean);
  const tags = {};
  const albums = {};

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch (err) {
      console.warn(`  skipping malformed line: ${line.slice(0, 80)}`);
      continue;
    }

    const { id } = record;
    if (!id) continue;

    if (Array.isArray(record.tags)) {
      for (const tag of record.tags) {
        if (!tags[tag]) tags[tag] = [];
        if (!tags[tag].includes(id)) tags[tag].push(id);
      }
    }

    if (record.album) {
      if (!albums[record.album]) albums[record.album] = [];
      if (!albums[record.album].includes(id)) albums[record.album].push(id);
    }
  }

  writeFileSync(TAGS_PATH, JSON.stringify(tags, null, 2) + '\n', 'utf8');
  writeFileSync(ALBUMS_PATH, JSON.stringify(albums, null, 2) + '\n', 'utf8');

  console.log(`✓ index/tags.json   — ${Object.keys(tags).length} tag(s)`);
  console.log(`✓ index/albums.json — ${Object.keys(albums).length} album(s)`);
}

main();
