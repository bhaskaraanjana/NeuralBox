export function normalizeSettingsTab(tab = 'regular') {
  return tab === 'advanced' ? 'advanced' : 'regular';
}

export function isSettingGroupVisible(level = 'regular', activeTab = 'regular') {
  const normalizedLevel = normalizeSettingsTab(level);
  const normalizedTab = normalizeSettingsTab(activeTab);
  return normalizedLevel === normalizedTab;
}

export function getDeterministicModeNotice(enabled) {
  return enabled
    ? 'Deterministic Team Mode enabled.'
    : 'Deterministic Team Mode disabled.';
}

export function parseDeterministicSeedInput(value, fallbackSeed = 42) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (Number.isFinite(parsed)) {
    return {
      ok: true,
      seed: parsed,
      inputValue: String(parsed),
      error: '',
    };
  }
  const fallback = Number.isFinite(fallbackSeed) ? Math.trunc(fallbackSeed) : 42;
  return {
    ok: false,
    seed: fallback,
    inputValue: String(fallback),
    error: 'Seed must be an integer.',
  };
}
