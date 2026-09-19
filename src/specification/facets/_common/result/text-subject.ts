import { getCallerDir } from '../caller.js';
import { TextAccessor } from './text.js';

/**
 * Wrap an arbitrary string into a {@link TextAccessor} anchored on the calling
 * test's directory — the same caller-detection the builders use.
 *
 * The product surface of a test framework is its own error messages, checker
 * output, and reports; those deserve the same goldening as any other output.
 * `text()` makes an ad-hoc string a first-class snapshot subject:
 *
 * ```typescript
 * const message = await catchMessage(() => expect(result.response).toMatch('wrong-body.http'));
 * expect(text(message)).toMatch('wrong-body-error.txt'); // resolves to _expected/
 * ```
 *
 * ANSI is stripped before every comparison (the raw form stays on `.text`),
 * the `{{token}}` grammar applies to the fixture, and `.grep()` composition
 * works exactly as on any stream accessor.
 *
 * The ANCHOR is why this sits apart from the accessor it builds: reading the
 * caller's frame means reading a stack and a real path, which is node's alone.
 * {@link TextAccessor} itself is a pure projection over a captured string, so
 * it loads in a page — and the browser entry builds its own `text()`, where
 * the golden commands resolve `_expected/` from the test's path server-side.
 */
export function text(value: string): TextAccessor {
    return new TextAccessor(value, 'text', getCallerDir());
}
