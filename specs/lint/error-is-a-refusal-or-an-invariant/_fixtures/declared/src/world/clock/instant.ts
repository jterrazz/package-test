import { invariant } from '../../kernel/refusals/invariant.js';

export function instantOf(at: Date | undefined): Date {
    if (at === undefined) {
        throw invariant('an instant was read before it was parsed');
    }
    return at;
}
