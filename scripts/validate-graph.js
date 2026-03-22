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

detectCycle();
