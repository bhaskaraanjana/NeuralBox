function hasInputText(inputText) {
  return Boolean(String(inputText ?? '').trim());
}

export function shouldDisableSendButton({
  isGenerating = false,
  inputText = '',
  hasPendingImage = false,
} = {}) {
  if (isGenerating) return false;
  return !hasInputText(inputText) && !hasPendingImage;
}

export function resolvePrimaryComposerAction({
  isGenerating = false,
  inputText = '',
  hasPendingImage = false,
  hasEngine = false,
} = {}) {
  if (isGenerating) return 'cancel';
  if (!hasEngine) return 'noop';
  if (!hasInputText(inputText) && !hasPendingImage) return 'noop';
  return 'send';
}
