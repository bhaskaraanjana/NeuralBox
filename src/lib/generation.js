const CANCELLED_BY_USER_RE = /cancelled by user/i;

export function isGenerationInterrupted({
  cancelRequested = false,
  generationId = 0,
  activeGenerationId = 0,
} = {}) {
  return Boolean(cancelRequested) || generationId !== activeGenerationId;
}

export function isGenerationCancelledError({
  errText = '',
  cancelRequested = false,
  generationId = 0,
  activeGenerationId = 0,
} = {}) {
  if (CANCELLED_BY_USER_RE.test(String(errText || ''))) return true;
  return isGenerationInterrupted({
    cancelRequested,
    generationId,
    activeGenerationId,
  });
}

export function buildRouteSwitchFailureReason({
  routeReason = '',
  activeModelName = '',
} = {}) {
  const safeReason = String(routeReason || '').trim() || 'Auto routing';
  const safeModelName = String(activeModelName || '').trim() || 'current model';
  return `${safeReason} (switch failed, stayed on ${safeModelName})`;
}

export function getRouteSwitchFailureNotice() {
  return 'Model switch failed, continuing on current model...';
}
