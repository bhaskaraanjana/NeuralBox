import {
  buildRouteSwitchFailureReason,
  getRouteSwitchFailureNotice,
  isGenerationCancelledError,
  isGenerationInterrupted,
} from '../src/lib/generation.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(
    isGenerationInterrupted({
      cancelRequested: true,
      generationId: 2,
      activeGenerationId: 2,
    }) === true,
    'Expected interruption when cancelRequested=true.',
  );

  assert(
    isGenerationInterrupted({
      cancelRequested: false,
      generationId: 2,
      activeGenerationId: 3,
    }) === true,
    'Expected interruption when generation IDs differ.',
  );

  assert(
    isGenerationInterrupted({
      cancelRequested: false,
      generationId: 2,
      activeGenerationId: 2,
    }) === false,
    'Expected no interruption when cancel=false and IDs match.',
  );

  assert(
    isGenerationCancelledError({
      errText: 'Generation cancelled by user.',
      cancelRequested: false,
      generationId: 1,
      activeGenerationId: 1,
    }) === true,
    'Expected cancelled-error detection from error text.',
  );

  assert(
    isGenerationCancelledError({
      errText: 'Some runtime error',
      cancelRequested: true,
      generationId: 1,
      activeGenerationId: 1,
    }) === true,
    'Expected cancelled-error detection from interruption state.',
  );

  assert(
    isGenerationCancelledError({
      errText: 'Some runtime error',
      cancelRequested: false,
      generationId: 4,
      activeGenerationId: 4,
    }) === false,
    'Expected non-cancelled error when interruption conditions are false.',
  );

  const reason = buildRouteSwitchFailureReason({
    routeReason: 'Escalated to thinker model',
    activeModelName: 'Qwen 3 - 0.6B',
  });
  assert(
    reason === 'Escalated to thinker model (switch failed, stayed on Qwen 3 - 0.6B)',
    'Unexpected route-switch failure reason format.',
  );

  assert(
    getRouteSwitchFailureNotice() === 'Model switch failed, continuing on current model...',
    'Unexpected route-switch failure notice text.',
  );

  console.log('Generation lifecycle test passed.');
}

run();
