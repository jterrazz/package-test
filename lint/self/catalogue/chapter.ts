import { rowTable } from '../../catalogue/chapter.js';
import { selfCatalog } from './manifest.js';

export const SELF_START =
    '<!-- GENERATED:self-rules — do not edit by hand; run `npm run docs`. Source: lint/self/catalogue/manifest.ts -->';
export const SELF_END = '<!-- /GENERATED:self-rules -->';

export function spliceSelfRules(existing: string): string {
    const start = existing.indexOf(SELF_START);
    const end = existing.indexOf(SELF_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/03-testing.md is missing the GENERATED:self-rules markers (${SELF_START} … ${SELF_END})`,
        );
    }
    const inner = rowTable(selfCatalog).join('\n');
    return `${existing.slice(0, start)}${SELF_START}\n\n${inner}\n\n${SELF_END}${existing.slice(end + SELF_END.length)}`;
}
