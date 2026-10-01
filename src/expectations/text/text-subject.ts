import { getCallerDir } from '../../chain/paths/caller.js';
import { TextAccessor } from './text.js';

/** Wrap a string as a `TextAccessor` anchored on the calling test's directory. */
export function text(value: string): TextAccessor {
    return new TextAccessor(value, 'text', getCallerDir());
}
