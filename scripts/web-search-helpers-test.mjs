import {
  classifyWebSearchError,
  getWebSearchNoResultsNotice,
  getWebSearchRecoveryNotice,
  shouldAutoWebSearch,
} from '../src/lib/web-search.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`Web search helpers test failed: ${message}`);
    process.exit(1);
  }
}

function run() {
  assert(shouldAutoWebSearch('what is the weather today') === true, 'Today/weather query should auto-search.');
  assert(shouldAutoWebSearch('write a short poem') === false, 'Stable creative prompt should not auto-search.');
  assert(shouldAutoWebSearch('search web: vite advisory') === true, 'Explicit search command should auto-search.');

  const timeout = classifyWebSearchError(new Error('The operation timed out'));
  assert(timeout.kind === 'timeout', 'Timeout errors should be classified.');
  assert(timeout.retryable === true, 'Timeout should be retryable.');

  const endpoint = classifyWebSearchError('Search endpoint returned HTTP 503');
  assert(endpoint.kind === 'endpoint', 'HTTP 503 should be endpoint failure.');
  assert(endpoint.status === 503, 'HTTP status should be retained.');

  const rateLimited = classifyWebSearchError('Search endpoint returned HTTP 429');
  assert(rateLimited.kind === 'rate_limited', 'HTTP 429 should be rate limited.');

  const parse = classifyWebSearchError('JSON parse failed');
  assert(parse.kind === 'parse', 'Parse errors should be classified.');
  assert(parse.retryable === false, 'Parse errors should not be marked retryable.');

  assert(
    getWebSearchRecoveryNotice(timeout, { mode: 'auto' }).includes('Auto web search timed out'),
    'Auto timeout recovery notice mismatch.',
  );
  assert(
    getWebSearchNoResultsNotice('manual').includes('Web search found no usable results'),
    'Manual no-results notice mismatch.',
  );
}

run();
console.log('Web search helpers test passed.');
