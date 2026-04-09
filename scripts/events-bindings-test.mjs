import { bindTap } from '../src/lib/events.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeElement {
  constructor() {
    this.handlers = new Map();
  }

  addEventListener(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.handlers.get(type)?.delete(handler);
  }

  emit(type, event = {}) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) {
      handler(event);
    }
  }
}

function run() {
  const fake = new FakeElement();
  let count = 0;
  let prevented = false;

  const realNow = Date.now;
  let now = 10_000;
  Date.now = () => now;

  const cleanup = bindTap(fake, () => {
    count += 1;
  }, { touchGapMs: 1000 });

  fake.emit('click');
  assert(count === 1, 'Click should trigger handler.');

  fake.emit('touchend', {
    preventDefault() {
      prevented = true;
    },
  });
  assert(prevented === true, 'Touch event should call preventDefault.');
  assert(count === 2, 'Touch should trigger handler once.');

  fake.emit('click');
  assert(count === 2, 'Synthetic click after touch should be ignored.');

  now += 1500;
  fake.emit('click');
  assert(count === 3, 'Click after touch gap should trigger handler.');

  cleanup();
  fake.emit('click');
  assert(count === 3, 'Cleanup should remove tap listeners.');

  Date.now = realNow;
  console.log('Event binding tap test passed.');
}

run();
