import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { runInNewContext } from 'node:vm';

import { dedent } from '../src/expectations/text/dedent.js';
import { forgetTree } from '../src/kernel/files/git-tree.js';
import { GROUND_SEEDS } from '../src/kernel/files/ground.js';
import { findSpecsRoots, listFiles, suppressedLines } from './checker-crossfile.js';
import { importsFromEntry, withEntryImport, withoutEntryImport } from './checker-migration.js';
import type { TokenViolation } from './checker.js';
import { isInside, kebabName, literalSpans, titleAround } from './spec-values.js';
import { skipString, withoutComments } from './subject.js';

/**
 * C28's seed branch — SQL is never written in a test.
 *
 * A seed is a `.sql` file: `.seed(file('./seeds/<name>.sql'))`, beside the
 * test when it alone reads it. A spec still tagging its statements with the
 * `sql` template of the vision/17 prototype — imported from the framework's
 * entry, which exports it no more — is refused where the tag stands, and
 * `--fix` writes the statements to `./seeds/<name>.sql` beside the spec: the
 * name is the first `--` comment of the SQL, kebab-cased, else the first four
 * meaningful words of the title of the test that holds it, else `seed`; a
 * name taken by other bytes gains
 * `-2`, `-3`, …, and one holding the same bytes is reused.
 */

/** A spec or module test: the files whose code seeds. */
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/u;

/** The tag, where it opens a template — never a member (`db.sql`) nor a longer name. */
const SQL_TAG = /(?<![.\w$])sql\s*(?=`)/gu;

/** One `sql` template a spec writes. */
type InlineSeed = {
    column: number;
    /** Past the template's closing backtick. */
    end: number;
    file: string;
    line: number;
    /** The name its file takes, before a collision's suffix. */
    name: string;
    start: number;
    /** The statements, dedented as the runtime read them — `undefined` when a hole makes them no literal. */
    statements: string | undefined;
};

/** The first `--` comment of a seed's statements, as a file name — `undefined` when it has none. */
export function commentName(statements: string): string | undefined {
    const comment = /^\s*--\s*(?<words>.*\S)/mu.exec(statements)?.groups?.words;
    const name = comment === undefined ? '' : kebabName(comment);
    return name === '' ? undefined : name;
}

/** The words a title reads through without them saying what the seed holds. */
const FILLER = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'each',
    'for',
    'from',
    'in',
    'into',
    'is',
    'it',
    'its',
    'of',
    'on',
    'or',
    'that',
    'the',
    'then',
    'this',
    'to',
    'when',
    'with',
]);

/** A test's title as a seed's file name: its first four meaningful words, kebab-cased — `undefined` when it has none. */
export function titleName(title: string): string | undefined {
    const words = kebabName(title)
        .split('-')
        .filter((word) => word !== '' && !FILLER.has(word));
    return words.length === 0 ? undefined : words.slice(0, 4).join('-');
}

/** The statements a hole-less template states, escapes read — `undefined` when it holds a hole. */
function statementsOf(template: string): string | undefined {
    if (/(?<!\\)\$\{/u.test(template)) {
        return undefined;
    }
    const value: unknown = runInNewContext(template, Object.create(null) as object);
    return typeof value === 'string' ? dedent(value) : undefined;
}

/** Every `sql` template a test file writes, where the tag stands. */
function inlineSeedsIn(file: string): InlineSeed[] {
    const source = readFileSync(file, 'utf8');
    if (!importsFromEntry(source, 'sql')) {
        return [];
    }
    const text = withoutComments(source);
    const literals = literalSpans(text);
    const seeds: InlineSeed[] = [];
    for (const found of text.matchAll(SQL_TAG)) {
        if (isInside(literals, found.index)) {
            continue;
        }
        const open = found.index + found[0].length;
        const end = skipString(text, open);
        const statements = statementsOf(text.slice(open, end));
        const before = text.slice(0, found.index);
        seeds.push({
            column: found.index - before.lastIndexOf('\n'),
            end,
            file,
            line: before.split('\n').length,
            name:
                (statements === undefined ? undefined : commentName(statements)) ??
                titleName(titleAround(text, found.index) ?? '') ??
                'seed',
            start: found.index,
            statements,
        });
    }
    const suppressed = suppressedLines(source, 'c28');
    return seeds.filter((seed) => !suppressed.has(seed.line));
}

/** Every `sql` template the specs trees under `rootDir` write. */
function inlineSeeds(rootDir: string): InlineSeed[] {
    return findSpecsRoots(rootDir).flatMap((root) =>
        listFiles(root, (path) => TEST_FILE.test(path)).flatMap((file) => inlineSeedsIn(file)),
    );
}

/** C28 — every `sql` template a spec writes, reported where its tag stands. */
export function checkInlineSeeds(rootDir: string): TokenViolation[] {
    return inlineSeeds(rootDir).map((seed) => ({
        column: seed.column,
        file: relative(rootDir, seed.file),
        fix: `write the statements to ./${GROUND_SEEDS}/${seed.name}.sql and seed it with file('./${GROUND_SEEDS}/${seed.name}.sql') — \`make fix\` writes the file`,
        found: 'SQL written in the test, tagged `sql`',
        line: seed.line,
        rule: 'c28-ground-shared-or-inline' as const,
        severity: 'error' as const,
    }));
}

/** The seed file `name` takes beside `file`: its own bytes reused, another's skipped past with a suffix. */
function seedPath(file: string, name: string, statements: string): string {
    const folder = join(dirname(file), GROUND_SEEDS);
    for (let suffix = 1; ; suffix += 1) {
        const path = join(folder, `${name}${suffix === 1 ? '' : `-${suffix}`}.sql`);
        if (!existsSync(path) || readFileSync(path, 'utf8') === statements) {
            return path;
        }
    }
}

/**
 * Apply the seed branch: every hole-less `sql` template becomes a
 * `./seeds/<name>.sql` beside its spec, named by `file()` where it stood; the
 * `sql` import goes and `file` comes. Returns what it wrote, below `rootDir`.
 */
export function fixInlineSeeds(rootDir: string): string[] {
    const done: string[] = [];
    const byFile = Map.groupBy(
        inlineSeeds(rootDir).filter((seed) => seed.statements !== undefined),
        (seed) => seed.file,
    );
    for (const [file, seeds] of byFile) {
        let text = readFileSync(file, 'utf8');
        for (const seed of seeds.toSorted((a, b) => b.start - a.start)) {
            const statements = seed.statements ?? '';
            const path = seedPath(file, seed.name, statements);
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, statements);
            const named = `./${relative(dirname(file), path).split('\\').join('/')}`;
            text = `${text.slice(0, seed.start)}file('${named}')${text.slice(seed.end)}`;
            done.push(`${relative(rootDir, file)}:${seed.line} → ${relative(rootDir, path)}`);
        }
        const named = withEntryImport(text, file, 'file');
        writeFileSync(
            file,
            /(?<![.\w$])sql\s*`/u.test(withoutComments(named))
                ? named
                : withoutEntryImport(named, 'sql'),
        );
    }
    forgetTree();
    return done;
}
