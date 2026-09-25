import { createRequire } from 'node:module';
import type { parseSync } from 'oxc-parser';

/**
 * The `oxc-parser` dependency, wrapped once: a module the linted file names
 * is parsed into the same ESTree shape oxlint hands a rule, so a rule that
 * walks past the file it was given reads the next one with its own visitor.
 *
 * The native binding loads on the first parse, never at import: a lint run
 * that walks no second module pays nothing for it.
 */

let parse: typeof parseSync | undefined;

/**
 * The program a module's source parses to, its dialect read from its
 * extension — `undefined` when the source does not parse.
 */
export function parseProgram(filename: string, source: string): unknown {
    if (parse === undefined) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `require` answers `any`: `parseSync` is the one export this reads, typed by oxc-parser's own declaration
        const loaded = createRequire(import.meta.url)('oxc-parser') as {
            parseSync: typeof parseSync;
        };
        parse = loaded.parseSync;
    }
    const { errors, program } = parse(filename, source);
    return errors.length === 0 ? program : undefined;
}
