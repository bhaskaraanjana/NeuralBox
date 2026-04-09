import {
  getDeterministicModeNotice,
  isSettingGroupVisible,
  normalizeSettingsTab,
  parseDeterministicSeedInput,
} from '../src/lib/settings.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(normalizeSettingsTab('advanced') === 'advanced', 'Advanced tab should stay advanced.');
  assert(normalizeSettingsTab('anything') === 'regular', 'Unknown tab should normalize to regular.');

  assert(isSettingGroupVisible('regular', 'regular') === true, 'Regular setting should be visible on regular tab.');
  assert(isSettingGroupVisible('advanced', 'regular') === false, 'Advanced setting should be hidden on regular tab.');

  assert(getDeterministicModeNotice(true).includes('enabled'), 'Enabled notice text missing.');
  assert(getDeterministicModeNotice(false).includes('disabled'), 'Disabled notice text missing.');

  const valid = parseDeterministicSeedInput('123', 42);
  assert(valid.ok === true && valid.seed === 123, 'Valid seed parsing failed.');

  const invalid = parseDeterministicSeedInput('abc', 99);
  assert(invalid.ok === false, 'Invalid seed should fail parsing.');
  assert(invalid.seed === 99, 'Invalid seed should preserve fallback.');
  assert(invalid.error === 'Seed must be an integer.', 'Invalid seed error text mismatch.');

  console.log('Settings helpers test passed.');
}

run();
