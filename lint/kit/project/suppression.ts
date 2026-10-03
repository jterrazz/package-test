import { holdsDirectives, suppressionDirectives } from '@jterrazz/typescript/rules';
import type { Directive } from '@jterrazz/typescript/rules';
import { relative } from 'node:path';

import { listFiles, readText } from './tree.js';

export { holdsDirectives } from '@jterrazz/typescript/rules';

export const { directivesIn, suppressedLines } = suppressionDirectives('checker');

type PlacedDirective = Directive & { path: string };

export function directivesUnder(rootDir: string): PlacedDirective[] {
    return listFiles(rootDir, holdsDirectives).flatMap((file) =>
        directivesIn(readText(file)).map(({ ids, line, rest }) => ({
            ids,
            line,
            path: relative(rootDir, file),
            rest,
        })),
    );
}
