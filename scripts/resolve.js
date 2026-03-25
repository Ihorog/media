#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function resolveBrand(brandId) {
  const graphPath = path.join(__dirname, '../resources/graph/brand_graph.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

  const node = graph.nodes[brandId];
  if (!node) {
    throw new Error(`Brand "${brandId}" not found in graph`);
  }

  // Build resolution chain (root → target)
  const chain = [];
  let current = node;
  while (current) {
    chain.unshift(current);
    current = current.extends ? graph.nodes[current.extends] : null;
  }

  // Merge manifests along the chain
  let resolved = {};
  for (const chainNode of chain) {
    const manifestPath = path.join(__dirname, '..', chainNode.manifest);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    resolved = deepMerge(resolved, manifest);

    // Apply overlays for brand-type nodes
    if (chainNode.type === 'brand' && chainNode.overlays) {
      const tokensPatchPath = path.join(__dirname, '..', chainNode.overlays, 'tokens.patch.json');
      if (fs.existsSync(tokensPatchPath)) {
        let patch;
        try {
          patch = JSON.parse(fs.readFileSync(tokensPatchPath, 'utf8'));
        } catch (err) {
          throw new Error(`Failed to parse patch file "${tokensPatchPath}": ${err.message}`);
        }
        resolved = deepMerge(resolved, patch);
      }
    }
  }

  return resolved;
}

function deepMerge(target, source) {
  const output = Object.assign({}, target);
  for (const key in source) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      key in output &&
      typeof output[key] === 'object'
    ) {
      output[key] = deepMerge(output[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

module.exports = { resolveBrand, deepMerge };

// CLI
if (require.main === module) {
  const brandId = process.argv[2];
  if (!brandId) {
    console.error('Usage: resolve.js <brand_id>');
    process.exit(1);
  }

  try {
    const resolved = resolveBrand(brandId);
    const json = JSON.stringify(resolved, null, 2);
    const outPath = path.join(process.cwd(), 'resolved_manifest.json');
    fs.writeFileSync(outPath, json + '\n', 'utf8');
    console.log(`✓ Resolved manifest written to ${outPath}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
