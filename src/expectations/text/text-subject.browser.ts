import { TextAccessor } from './text.js';

/** `text()` in a page: no anchor, since the golden commands read the test's path server-side. */
export function text(value: string): TextAccessor {
    return new TextAccessor(value, 'text', '');
}
