const DEFAULT_TOUCH_GAP_MS = 550;

export function bindTap(element, handler, options = {}) {
  if (!element || typeof element.addEventListener !== 'function' || typeof handler !== 'function') {
    return () => {};
  }

  const preventDefaultTouch = options.preventDefaultTouch !== false;
  const touchGapMs = Number.isFinite(options.touchGapMs)
    ? options.touchGapMs
    : DEFAULT_TOUCH_GAP_MS;

  let lastTouchAt = 0;

  const onClick = (event) => {
    if (Date.now() - lastTouchAt < touchGapMs) {
      return;
    }
    handler(event);
  };

  const onTouchEnd = (event) => {
    if (preventDefaultTouch && typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    lastTouchAt = Date.now();
    handler(event);
  };

  element.addEventListener('click', onClick);
  element.addEventListener('touchend', onTouchEnd);

  return () => {
    if (typeof element.removeEventListener === 'function') {
      element.removeEventListener('click', onClick);
      element.removeEventListener('touchend', onTouchEnd);
    }
  };
}
