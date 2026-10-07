import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TOOLCHAIN_RULES } from '../../consumer/catalogue/manifest.js';
import { CHECKER_PASS_IDS as CHECKER_PASS_REGISTRY } from '../../consumer/checks/checker.js';
import { testPreset } from '../../consumer/rulebook/preset.js';
import plugin from '../../index.oxlint.js';
import { META_ROWS, SELF_TOOLCHAIN_RULES } from '../catalogue/manifest.js';
import { SELF_CHECKER_PASS_IDS } from '../checks/checker.js';
import { sourceRootHoldsKnownEntries } from '../checks/source-root-holds-known-entries.js';
import selfPlugin from '../rules/plugin.js';

export const ROOT = resolve(import.meta.dirname, '../../..');

export const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const withoutGenerated = (text: string): string =>
    text.replaceAll(/<!-- GENERATED:[\s\S]*?<!-- \/GENERATED:[^>]*-->/gu, '');

export const humanWords = (entry: { audience?: string }): string =>
    entry.audience === 'self'
        ? withoutGenerated(read('docs/guides/test.md'))
        : ((read('docs/concepts/conventions.md').split('## What stays human')[1] ?? '').split(
              '\n## ',
          )[0] ?? '');

export const allRules = { ...plugin.rules, ...selfPlugin.rules };

export const pluginRules = new Set(Object.keys(allRules));

export function namespaceOf(id: string): string {
    return id in selfPlugin.rules ? 'jterrazz-self' : 'jterrazz';
}

/** A spec marks the runtime row it proves with `// RUNTIME <row name> — <the sentence>` above its test. */
export function runtimeMarkers(): Set<string> {
    const found = new Set<string>();
    for (const root of ['specs', 'src']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            if (
                (!path.endsWith('.spec.ts') && !path.endsWith('.test.ts')) ||
                path.includes('__fixtures__/')
            ) {
                continue;
            }
            for (const match of read(path).matchAll(/\/\/ RUNTIME (?<id>[a-z][a-z-]+) —/gu)) {
                found.add(match.groups?.id ?? '');
            }
        }
    }
    return found;
}

// invariant: a rule's specs in `specs/lint/<id>/`, on the lint specification; `meta/` holds the specs named for the meta row they prove.
export const lintSpecEntries = (specsLint: string): string[] =>
    readdirSync(specsLint, { recursive: true }).map((entry) => String(entry).replaceAll('\\', '/'));

export const specsOf = (entries: readonly string[], id: string): string[] =>
    entries.filter(
        (entry) => entry.startsWith(`${id}/`) && /^[^/]+\/[^/]+\.spec\.ts$/u.test(entry),
    );

export const withSpecsOf = (entries: readonly string[]): Set<string> =>
    new Set(
        entries
            .filter((entry) => /^[a-z0-9-]+\/[^/]+\.spec\.ts$/u.test(entry))
            .map((entry) => entry.slice(0, entry.indexOf('/'))),
    );

export const e2eSpecIdsOf = (entries: readonly string[]): Set<string> =>
    new Set([
        ...[...withSpecsOf(entries)].filter((id) => id !== 'meta'),
        ...specsOf(entries, 'meta').map((entry) => entry.slice('meta/'.length, -'.spec.ts'.length)),
    ]);

export function metaProofs(specsLint: string): Set<string> {
    const found = new Set<string>();
    const sources = [
        read('lint/self/catalogue/__tests__/manifest.test.ts'),
        read('lint/self/corpus/__tests__/catalogue-rows.test.ts'),
        read('lint/self/corpus/__tests__/catalogue-proofs.test.ts'),
        read('lint/self/corpus/__tests__/coordinates.test.ts'),
        read('lint/self/corpus/__tests__/architecture.test.ts'),
        read('lint/self/corpus/__tests__/audience.test.ts'),
        read('lint/self/corpus/__tests__/env-allowlist.test.ts'),
        read('lint/self/corpus/__tests__/messages.test.ts'),
        read('lint/self/corpus/__tests__/matrix.test.ts'),
        read('lint/self/corpus/__tests__/port-readers.test.ts'),
        read('lint/self/corpus/__tests__/positions.test.ts'),
        read('lint/self/corpus/__tests__/siblings.test.ts'),
    ];
    for (const path of lintSpecEntries(specsLint)) {
        if (path.endsWith('.test.ts') && !path.includes('__fixtures__/')) {
            sources.push(readFileSync(resolve(specsLint, path), 'utf8'));
        }
    }
    for (const row of META_ROWS) {
        if (sources.some((text) => text.includes(row.name))) {
            found.add(row.name);
        }
    }
    return found;
}

export const CHECKER_PASS_IDS = new Set<string>(CHECKER_PASS_REGISTRY);

export const TOOLCHAIN_ROWS = new Set(
    [...TOOLCHAIN_RULES, ...SELF_TOOLCHAIN_RULES].map((row) => row.name),
);

export const handedToTheToolchain = new Set([
    ...(testPreset().layers ?? []).map(({ name }) => name),
    ...(testPreset().names ?? []).map(({ name }) => name),
    sourceRootHoldsKnownEntries.name,
]);

export const SELF_PASSES = new Set<string>(SELF_CHECKER_PASS_IDS);

/** Files probing the CLI boundary, plus the `output-asserted-as-a-golden` kitchen-sink, sit outside the rule↔fixture inventory. */
export const CLI_CONTRACT_SPECS = new Set(['kitchen-sink']);

export const SPECIFICATION_CONTRACT_SPECS = new Set(['linters', 'rule-tester']);

export const citingFiles = (): string[] => {
    const found: string[] = [];
    for (const root of ['docs', 'skills']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            // invariant: a decision record is never edited: the ids it removed resolve to nothing by design.
            if (path.endsWith('.md') && !path.startsWith('docs/decisions/')) {
                found.push(path);
            }
        }
    }
    found.push('README.md');
    return found;
};

const DEAD_ID_INPUT =
    'specs/lint/checker-suppression-names-a-pass/__fixtures__/checker-suppression-names-a-pass/';

/** Comments cite too. */
export const citingSources = (): string[] => {
    const found: string[] = [];
    for (const root of ['src', 'specs']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            if (
                (path.endsWith('.ts') || path.endsWith('.tsx')) &&
                !path.startsWith(DEAD_ID_INPUT)
            ) {
                found.push(path);
            }
        }
    }
    return found;
};

export const NAME = String.raw`[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;

const TICK = '`';

const CITED = `${TICK}${NAME}${TICK}`;

const citationPatterns = (): RegExp[] => [
    new RegExp(String.raw`\brules?\s+(${CITED}(?:\s*(?:,|and|or|/)\s*${CITED})*)`, 'gu'),
    new RegExp(String.raw`(?<![@\w./-])jterrazz(?:-self)?/(${NAME})(?![\w/-])`, 'gu'),
    new RegExp(String.raw`\bjterrazz(?:-self)?-check[(/](${NAME})`, 'gu'),
    new RegExp(
        String.raw`checker-disable(?:-next)?-line\s+((?:${NAME}|\*)(?:,\s*(?:${NAME}|\*))*)(?=\s+--|\s*$|${TICK})`,
        'giu',
    ),
];

export const idsCitedIn = (line: string): string[] =>
    citationPatterns().flatMap((pattern) =>
        [...line.matchAll(pattern)].flatMap((match) =>
            (match[1] ?? '')
                .replaceAll('`', '')
                .split(/[\s,/]+/u)
                .filter((id) => !['', '*', 'and', 'or'].includes(id)),
        ),
    );
