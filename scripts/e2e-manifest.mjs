// ============================================================
// Data-driven E2E manifest.
// One row per studio describing how to exercise it. Adding a studio
// here gives it an E2E entry "for free": drive it with
//   STUDIO=<id> [CLICK_TIER=<label>] node scripts/studio-run-check.mjs
// (image/text studios) or the dedicated audio/chat/pipeline checks.
// LIGHT is the small-model subset suitable for a quick local sweep.
// ============================================================

export const E2E_MANIFEST = [
  // Vision
  { id: 'object-detection', input: 'image', light: true, tiers: ['Fast', 'Accurate', 'Max'] },
  { id: 'zero-shot-detection', input: 'image', light: false, tiers: ['Fast', 'Accurate'] },
  { id: 'image-classification', input: 'image', light: true, tiers: ['Fast', 'Accurate'] },
  { id: 'zero-shot-image', input: 'image', light: false, tiers: ['Fast', 'Accurate'] },
  { id: 'segmentation', input: 'image', light: true, tiers: ['Fast', 'Accurate', 'Max'] },
  { id: 'depth', input: 'image', light: true, tiers: ['Fast', 'Detailed'] },
  { id: 'background-removal', input: 'image', light: true },
  { id: 'caption', input: 'image', light: true, tiers: ['Quick', 'Detailed'] },
  // Audio (use scripts/studio-audio-check.mjs)
  { id: 'speech-to-text', input: 'audio', runner: 'studio-audio-check.mjs', light: true },
  { id: 'text-to-speech', input: 'text', light: false },
  { id: 'audio-classification', input: 'audio', runner: 'studio-audio-check.mjs', light: false },
  // Language
  { id: 'sentiment', input: 'text', light: true },
  { id: 'text-emotion', input: 'text', light: false },
  { id: 'zero-shot-text', input: 'text', light: false, tiers: ['Fast', 'Accurate'] },
  { id: 'question-answering', input: 'text', light: true, tiers: ['Fast', 'Accurate'] },
  { id: 'summarize', input: 'text', light: false, tiers: ['Balanced', 'Fast', 'Headline'] },
  { id: 'translate', input: 'text', light: true },
  { id: 'semantic-search', input: 'text', light: true, tiers: ['BGE', 'GTE', 'MiniLM'] },
  { id: 'ner', input: 'text', light: true },
  { id: 'fill-mask', input: 'text', light: true },
  // Chat (use scripts/studio-chat-check.mjs)
  { id: 'mini-chat', input: 'text', runner: 'studio-chat-check.mjs', light: false },
  // Pipelines (use scripts/pipeline-check.mjs)
  { id: 'pipeline:caption->translate', runner: 'pipeline-check.mjs', light: true },
];

export const LIGHT = E2E_MANIFEST.filter((m) => m.light).map((m) => m.id);
