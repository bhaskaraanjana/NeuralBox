import { renderTrustMetaHtml } from '../src/lib/trust.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const html = renderTrustMetaHtml({
    modelName: 'Qwen 3 - 1.7B',
    profile: 'balanced',
    workflowLabel: 'General',
    deterministic: true,
    seed: 42,
    temperature: 0,
    maxTokens: 1024,
    webSources: 2,
    webMode: 'auto',
    ragSources: 3,
    ragDocNames: ['policy.md', 'incident.txt', 'runbook.md', 'extra.md'],
    hasImage: false,
    routeReason: 'Routed to thinker model',
    routeScore: 88,
  });

  assert(html.includes('Trust Layer: why this answer'), 'Trust summary label missing');
  assert(html.includes('Qwen 3 - 1.7B'), 'Model name missing');
  assert(html.includes('seed 42'), 'Deterministic seed details missing');
  assert(html.includes('policy.md, incident.txt, runbook.md, ...'), 'RAG doc summary truncation missing');
  assert(html.includes('(score 88)'), 'Route score missing');
  assert(!html.includes('<script>'), 'Unexpected unsafe raw HTML found');

  console.log('Trust metadata test passed.');
}

run();
