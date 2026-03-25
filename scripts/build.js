#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveBrand } = require('./resolve');

const ROOT = path.join(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'resources/graph/brand_graph.json');
const MEDIA_REGISTRY_PATH = path.join(ROOT, 'resources/media/registry.json');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_BRANDS_DIR = path.join(DIST_DIR, 'brands');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function buildMediaIndex(registry) {
  const byBrand = {};
  const byType = {};

  for (const assetId of Object.keys(registry.assets)) {
    const asset = registry.assets[assetId];

    if (!byBrand[asset.brand]) byBrand[asset.brand] = [];
    byBrand[asset.brand].push(assetId);

    if (!byType[asset.type]) byType[asset.type] = [];
    byType[asset.type].push(assetId);
  }

  return { byBrand, byType };
}

function main() {
  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(MEDIA_REGISTRY_PATH, 'utf8'));

  ensureDir(DIST_BRANDS_DIR);

  const mediaIndex = buildMediaIndex(registry);

  const index = {
    version: graph.version,
    builtAt: new Date().toISOString(),
    brands: {},
    mediaTypes: registry.mediaTypes,
    assetCount: Object.keys(registry.assets).length,
  };

  for (const nodeId of Object.keys(graph.nodes)) {
    const node = graph.nodes[nodeId];

    const resolved = resolveBrand(nodeId);

    // Attach resolved media asset records for each asset token declared in this brand
    const assetTokens = (resolved.tokens && resolved.tokens.assets) || {};
    const resolvedAssets = {};
    for (const [tokenKey, assetId] of Object.entries(assetTokens)) {
      if (registry.assets[assetId]) {
        resolvedAssets[tokenKey] = registry.assets[assetId];
      }
    }
    if (Object.keys(resolvedAssets).length > 0) {
      resolved.resolvedAssets = resolvedAssets;
    }

    const outFile = `${nodeId}.json`;
    const outPath = path.join(DIST_BRANDS_DIR, outFile);
    writeJson(outPath, resolved);
    console.log(`✓ Built ${nodeId} → dist/brands/${outFile}`);

    index.brands[nodeId] = {
      id: nodeId,
      type: node.type,
      extends: node.extends || null,
      resolvedPath: `brands/${outFile}`,
      mediaAssets: mediaIndex.byBrand[nodeId] || [],
    };
  }

  writeJson(path.join(DIST_DIR, 'index.json'), index);
  console.log('✓ Brand index written → dist/index.json');

  writeJson(path.join(DIST_DIR, 'media-registry.json'), registry);
  console.log('✓ Media registry written → dist/media-registry.json');
}

main();
