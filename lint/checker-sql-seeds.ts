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

/** The seed name is the first `--` comment of the SQL, else the first four meaningful words of the test's title, else `seed`; a name taken by other bytes gains `-2`, `-3`, … */

const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/u;

/** Never a member (`db.sql`) nor a longer name. */
const SQL_TAG = /(?<![.\w$])sql\s*(?=`)/gu;

type InlineSeed = {
    column: number;
    end: number;
    file: string;
    line: number;
    name: string;
    start: number;
    /** `undefined` when a hole makes them no literal. */
    statements: string | undefined;
};

export function commentName(statements: string): string | undefined {
    const comment = /^\s*--\s*(?<words>.*\S)/mu.exec(statements)?.groups?.words;
    const name = comment === undefined ? '' : kebabName(comment);
    return name === '' ? undefined : name;
}

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

export function titleName(title: string): string | undefined {
    const words = kebabName(title)
        .split('-')
        .filter((word) => word !== '' && !FILLER.has(word));
    return words.length === 0 ? undefined : words.slice(0, 4).join('-');
}

function statementsOf(template: string): string | undefined {
    if (/(?<!\\)\$\{/u.test(template)) {
        return undefined;
    }
    const value: unknown = runInNewContext(template, Object.create(null) as object);
    return typeof value === 'string' ? dedent(value) : undefined;
}

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

function inlineSeeds(rootDir: string): InlineSeed[] {
    return findSpecsRoots(rootDir).flatMap((root) =>
        listFiles(root, (path) => TEST_FILE.test(path)).flatMap((file) => inlineSeedsIn(file)),
    );
}

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

function seedPath(file: string, name: string, statements: string): string {
    const folder = join(dirname(file), GROUND_SEEDS);
    for (let suffix = 1; ; suffix += 1) {
        const path = join(folder, `${name}${suffix === 1 ? '' : `-${suffix}`}.sql`);
        if (!existsSync(path) || readFileSync(path, 'utf8') === statements) {
            return path;
        }
    }
}

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
