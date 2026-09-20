import { TextAccessor } from '../../core/result/text.js';

/**
 * A stream captured INSIDE the page.
 *
 * Structurally identical to any other {@link TextAccessor} — the same
 * `{{token}}` grammar, the same ANSI stripping, the same `.grep()` — and
 * marked so the matcher augmentation can say the one thing that differs: its
 * golden lives on the server, so `toMatch` is awaited here where it is
 * synchronous everywhere else.
 */
export class RenderedText extends TextAccessor {
    /** The marker the `toMatch` overload reads. Never asserted on directly. */
    readonly capturedInPage = true as const;
}
