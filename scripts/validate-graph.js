#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function detectCycle() {
  const graphPath = path.join(__dirname, '../resources/graph/brand_graph.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

  const visited = new Set();
  const stack = new Set();

  function dfs(nodeId) {
    if (stack.has(nodeId)) {
      throw new Error(`Cycle detected involving node: ${nodeId}`);
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    stack.add(nodeId);

    const node = graph.nodes[nodeId];
    if (!node) {
      throw new Error(`Referenced node "${nodeId}" not found in graph`);
    }
    if (node.extends) {
      dfs(node.extends);
    }

    stack.delete(nodeId);
  }

  for (const nodeId in graph.nodes) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  console.log('✓ No cycles detected');
}

function enforcePolicy() {
  const graphPath = path.join(__dirname, '../resources/graph/brand_graph.json');
  const policyPath = path.join(__dirname, '../resources/graph/policy.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

  // Enforce combined brand extension policy:
  // - "core.brand.fork" (deny): brands must not directly extend a core node other than cimeika.
  // - "brand.extends" (allow): brands may only extend cimeika.
  const coreForkRule = policy.rules && policy.rules['core.brand.fork'];
  const brandExtendsRule = policy.rules && policy.rules['brand.extends'];
  if (
    (coreForkRule && coreForkRule.action === 'deny') ||
    (brandExtendsRule && brandExtendsRule.action === 'allow')
  ) {
    for (const nodeId in graph.nodes) {
      const node = graph.nodes[nodeId];
      if (node.type === 'brand' && node.extends && node.extends !== 'cimeika') {
        throw new Error(
          `Policy violation: brand "${nodeId}" must extend "cimeika", but extends "${node.extends}".`
        );
      }
    }
    console.log('✓ Policy: all brands extend cimeika (no core.brand fork)');
  }
}

detectCycle();
enforcePolicy();
