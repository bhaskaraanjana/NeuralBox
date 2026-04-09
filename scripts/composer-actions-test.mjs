import {
  resolvePrimaryComposerAction,
  shouldDisableSendButton,
} from '../src/lib/composer.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(
    resolvePrimaryComposerAction({
      isGenerating: true,
      inputText: '',
      hasPendingImage: false,
      hasEngine: true,
    }) === 'cancel',
    'Expected generating state to resolve to cancel action.',
  );

  assert(
    resolvePrimaryComposerAction({
      isGenerating: false,
      inputText: 'hello',
      hasPendingImage: false,
      hasEngine: true,
    }) === 'send',
    'Expected text input to resolve to send action.',
  );

  assert(
    resolvePrimaryComposerAction({
      isGenerating: false,
      inputText: '   ',
      hasPendingImage: true,
      hasEngine: true,
    }) === 'send',
    'Expected pending image to allow send action without text.',
  );

  assert(
    resolvePrimaryComposerAction({
      isGenerating: false,
      inputText: 'hello',
      hasPendingImage: false,
      hasEngine: false,
    }) === 'noop',
    'Expected missing engine to resolve to noop action.',
  );

  assert(
    resolvePrimaryComposerAction({
      isGenerating: false,
      inputText: '   ',
      hasPendingImage: false,
      hasEngine: true,
    }) === 'noop',
    'Expected empty composer to resolve to noop action.',
  );

  assert(
    shouldDisableSendButton({
      isGenerating: true,
      inputText: '',
      hasPendingImage: false,
    }) === false,
    'Expected send button enabled while generating.',
  );

  assert(
    shouldDisableSendButton({
      isGenerating: false,
      inputText: 'hello',
      hasPendingImage: false,
    }) === false,
    'Expected send button enabled when text exists.',
  );

  assert(
    shouldDisableSendButton({
      isGenerating: false,
      inputText: '',
      hasPendingImage: true,
    }) === false,
    'Expected send button enabled when image exists.',
  );

  assert(
    shouldDisableSendButton({
      isGenerating: false,
      inputText: '   ',
      hasPendingImage: false,
    }) === true,
    'Expected send button disabled for empty composer.',
  );

  console.log('Composer action test passed.');
}

run();
