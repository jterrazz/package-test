/** `d4b-spec-shape` → `d4b`; alone, because both the passes and the publishing entry need one answer. */
export function codeOf(passId: string): string {
    return passId.split('-')[0] ?? passId;
}

export { CATALOGUE_CHAPTER } from '../src/kernel/refusals/refusal.js';
