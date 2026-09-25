import { TextAccessor } from '../../../expectations/text/text.js';

/** A stream captured inside the page: its golden lives on the server, so `toMatch` is awaited. */
export class RenderedText extends TextAccessor {
    /** The marker the `toMatch` overload reads. Never asserted on directly. */
    readonly capturedInPage = true as const;
}
