# Structure Specification

## Overview

This document describes the canonical repository structure for Cimeika media assets.

## Directory Layout

```
assets/
  img/
    <YYYY>/
      <MM>/
        sha256:<hex>.<ext>   ← canonical image file
index/
  images.jsonl               ← primary asset registry (newline-delimited JSON)
  tags.json                  ← derived index: tag → [id, ...]
  albums.json                ← derived index: album → [id, ...]
ops/
  STRUCTURE_SPEC.md          ← this file
  STRUCTURE_STATE.json       ← current structural health snapshot
scripts/
  scan-media.mjs             ← scan repo for images, detect duplicates
  ingest-images.mjs          ← ingest files into canonical structure
  build-indexes.mjs          ← rebuild derived indexes from images.jsonl
  validate-structure.mjs     ← validate structural invariants
```

## Path Conventions

- Canonical images live under `assets/img/<YYYY>/<MM>/`.
- `<YYYY>` and `<MM>` are derived from `taken_at` when available, otherwise `created_at`.
- Filename is `sha256:<hex>.<ext>` where `<hex>` is the full SHA-256 hash of the file content.

## Naming Conventions

- File extension is lowercase (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.heic`).
- `id` field uses the format `sha256:<hex>` (64 hex characters).

## Asset Record Format (`index/images.jsonl`)

Each line is a JSON object with the following fields:

| Field         | Type     | Required | Description                                      |
|---------------|----------|----------|--------------------------------------------------|
| `id`          | string   | ✓        | `sha256:<hex>` content hash                      |
| `path`        | string   | ✓        | Canonical path relative to repo root             |
| `ext`         | string   | ✓        | Lowercase file extension without dot             |
| `mime`        | string   | ✓        | MIME type                                        |
| `source`      | string   | ✓        | Origin device/source (e.g. `iphone`)             |
| `origin_path` | string   | ✓        | Original filename or path before ingestion       |
| `created_at`  | string   | ✓        | ISO 8601 timestamp of ingestion                  |
| `taken_at`    | string   |          | ISO 8601 timestamp when photo was taken          |
| `title`       | string   |          | Human-readable title                             |
| `tags`        | string[] |          | Classification tags                              |
| `album`       | string   |          | Album name                                       |
| `people`      | string[] |          | People depicted                                  |
| `notes`       | string   |          | Free-form notes                                  |

## Derived Indexes

### `index/tags.json`
```json
{
  "<tag>": ["sha256:<hex>", ...]
}
```

### `index/albums.json`
```json
{
  "<album>": ["sha256:<hex>", ...]
}
```

## Workflow

1. **Ingest** — run `npm run ingest -- --source <dir>` to copy/move files into `assets/img/`.
2. **Tag** — edit `index/images.jsonl` to add `tags`, `album`, `people`, etc.
3. **Build indexes** — run `npm run build:indexes` to regenerate derived indexes.
4. **Validate** — run `npm run validate` to verify structural integrity.
5. **Scan** — run `npm run scan` to audit the repo and update `ops/STRUCTURE_STATE.json`.

## Backward Compatibility

Existing files in the repository root and other directories remain untouched.
New canonical paths are additive and do not break existing references.
