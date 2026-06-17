import { MODEL_CATALOG } from '../src/lib/models.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`Model catalog test failed: ${message}`);
    process.exit(1);
  }
}

function run() {
  assert(Array.isArray(MODEL_CATALOG), 'MODEL_CATALOG should be an array.');
  assert(MODEL_CATALOG.length >= 10, 'MODEL_CATALOG should include curated and advanced models.');

  const ids = new Set();
  for (const model of MODEL_CATALOG) {
    assert(typeof model.id === 'string' && model.id.trim(), 'Every model needs an id.');
    assert(!ids.has(model.id), `Duplicate model id: ${model.id}`);
    ids.add(model.id);
    assert(typeof model.name === 'string' && model.name.trim(), `Model ${model.id} needs a name.`);
    assert(Number(model.vramMB) > 0, `Model ${model.id} needs a positive vramMB estimate.`);
    assert(typeof model.tier === 'string' && model.tier.trim(), `Model ${model.id} needs a tier.`);
  }

  assert(MODEL_CATALOG.some((model) => model.vision === true), 'Catalog should include at least one vision model.');
  assert(MODEL_CATALOG.some((model) => model.thinking === true), 'Catalog should include at least one thinking model.');
  assert(MODEL_CATALOG.some((model) => model.advanced === true), 'Catalog should include advanced models.');
}

run();
console.log('Model catalog test passed.');
