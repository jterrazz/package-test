import { TextAccessor } from './text.js';

/**
 * `text()` in a page — the node twin's accessor with no anchor. Under node the
 * accessor remembers the caller's directory so a golden resolves against it;
 * in a page the golden commands read the test's own path server-side, so there
 * is nothing for the accessor to carry, and the page loads no stack walk.
 */
export function text(value: string): TextAccessor {
    return new TextAccessor(value, 'text', '');
}
