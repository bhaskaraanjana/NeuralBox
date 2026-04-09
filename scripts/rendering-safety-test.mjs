import { formatBasicHTML, formatMarkdown, safeParseHttpUrl } from '../src/lib/rendering.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const escaped = formatBasicHTML('<script>alert(1)</script>\n**safe**');
  assert(!escaped.includes('<script>'), 'Raw script tags must be escaped');
  assert(escaped.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Escaped script content should be preserved as text');
  assert(escaped.includes('<strong>safe</strong>'), 'Basic markdown-style formatting should still work');

  const markdown = formatMarkdown('alpha\n<think>hidden reasoning</think>\nomega');
  assert(markdown.includes('<details class="think-block">'), 'Think blocks should render in details container');
  assert(markdown.includes('hidden reasoning'), 'Think block content should be preserved');

  const goodUrl = safeParseHttpUrl('https://example.com/path?q=1');
  assert(Boolean(goodUrl), 'HTTPS URL should parse');
  const badUrl = safeParseHttpUrl('javascript:alert(1)');
  assert(badUrl === null, 'javascript: URLs must be rejected');
  const malformedUrl = safeParseHttpUrl('http://');
  assert(malformedUrl === null, 'Malformed URLs must be rejected');

  console.log('Rendering safety test passed.');
}

run();
