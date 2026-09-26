import { createRequire } from 'node:module';
import type { parseSync } from 'oxc-parser';

/** Parsed into the ESTree shape oxlint hands a rule; the native binding loads on the first parse, never at import. */

let parse: typeof parseSync | undefined;

export function parsedModule(filename: string, source: string): ReturnType<typeof parseSync> {
    if (parse === undefined) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `require` answers `any`: `parseSync` is the one export this reads, typed by oxc-parser's own declaration
        const loaded = createRequire(import.meta.url)('oxc-parser') as {
            parseSync: typeof parseSync;
        };
        parse = loaded.parseSync;
    }
    return parse(filename, source);
}

export function parseProgram(filename: string, source: string): unknown {
    const { errors, program } = parsedModule(filename, source);
    return errors.length === 0 ? program : undefined;
}
