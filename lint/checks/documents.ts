import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import {
    assertedStreams,
    DOCUMENT_KEYS,
    readSpecFile,
    RUN_KEYS,
    SPEC_EXTENSION,
} from '../../src/facets/cli/documents/spec-document.js';
import type { SpecDocument, SpecFile } from '../../src/facets/cli/documents/spec-document.js';
import { treeEntries, treeKind, treeNames } from '../../src/kernel/files/git-tree.js';
import { GROUND_FIXTURES } from '../../src/kernel/files/ground.js';
import { resolveSpecPath } from '../../src/kernel/files/resolve.js';
import {
    isMap,
    isScalar,
    isSeq,
    renderYamlSource,
    Scalar,
} from '../../src/kernel/yaml/document.js';
import type { Node, Pair, YAMLMap } from '../../src/kernel/yaml/document.js';
import type { Teaching } from '../catalogue/lesson.js';
import type { CheckerPassId, Severity, TokenViolation } from './checker.js';

/** Key order and block scalars are fixable without judgment: the same `yaml` round trip update mode relies on keeps comments and everything else intact. */

type Finding = Teaching & {
    line: number;
    rule: CheckerPassId;
    severity: Severity;
};

function finding(
    rule: CheckerPassId,
    line: number,
    { fix, found }: Teaching,
    severity: Severity = 'error',
): Finding {
    return { fix, found, line, rule, severity };
}

/** `fixtures/` holds inputs, never scenarios. */
const PRUNED = new Set<string>(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

function listSpecFiles(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) {
                if (!PRUNED.has(entry.name)) {
                    visit(path);
                }
            } else if (entry.name.endsWith(SPEC_EXTENSION)) {
                out.push(path);
            }
        }
    };
    visit(dir);
    return out;
}

function readText(path: string): string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return '';
    }
}

// Styles and key order live only in the AST.

function documentMap(file: SpecFile): null | YAMLMap {
    const root = file.source.document.contents;
    return isMap(root) ? root : null;
}

function pairsOf(map: YAMLMap): Pair<Node, Node>[] {
    return map.items as Pair<Node, Node>[];
}

function keyName(pair: Pair<Node, Node>): null | string {
    return isScalar(pair.key) && typeof pair.key.value === 'string' ? pair.key.value : null;
}

function runMaps(file: SpecFile): YAMLMap[] {
    const map = documentMap(file);
    const items = map?.get('runs', true);
    return isSeq(items) ? (items.items as Node[]).filter((item) => isMap(item)) : [];
}

function streamScalars(run: YAMLMap): { key: string; scalar: Scalar }[] {
    const found: { key: string; scalar: Scalar }[] = [];
    for (const pair of pairsOf(run)) {
        const key = keyName(pair);
        if (key === null) {
            continue;
        }
        if (['stderr', 'stdin', 'stdout'].includes(key) && isScalar(pair.value)) {
            found.push({ key, scalar: pair.value });
            continue;
        }
        if (key !== 'files' || !isMap(pair.value)) {
            continue;
        }
        for (const entry of pairsOf(pair.value)) {
            if (!isMap(entry.value)) {
                continue;
            }
            for (const assertion of pairsOf(entry.value)) {
                if (keyName(assertion) === 'equals' && isScalar(assertion.value)) {
                    found.push({
                        key: `files.${keyName(entry) ?? '?'}.equals`,
                        scalar: assertion.value,
                    });
                }
            }
        }
    }
    return found;
}

function isBlock(scalar: Scalar): boolean {
    return String(scalar.type ?? '').startsWith('BLOCK');
}

function checkKeyOrder(file: SpecFile, lineAt: (node: Pair<Node, Node>) => number): Finding[] {
    const findings: Finding[] = [];
    const inspect = (map: YAMLMap, order: readonly string[], where: string): void => {
        let highest = -1;
        let highestKey = '';
        for (const pair of pairsOf(map)) {
            const key = keyName(pair);
            const rank = key === null ? -1 : order.indexOf(key);
            if (rank === -1) {
                continue;
            }
            if (rank < highest) {
                findings.push(
                    finding('document-keys-in-canonical-order', lineAt(pair), {
                        fix: `order the keys ${order.join(', ')} — \`make fix\` reorders them`,
                        found: `"${key}:" after "${highestKey}:" in ${where}`,
                    }),
                );
                return;
            }
            highest = rank;
            highestKey = key ?? '';
        }
    };
    const map = documentMap(file);
    if (map !== null) {
        inspect(map, DOCUMENT_KEYS, 'a spec document');
    }
    for (const run of runMaps(file)) {
        inspect(run, RUN_KEYS, 'a run');
    }
    return findings;
}

function checkBlockScalars(file: SpecFile, lineOf: (scalar: Scalar) => number): Finding[] {
    const findings: Finding[] = [];
    for (const run of runMaps(file)) {
        for (const { key, scalar } of streamScalars(run)) {
            if (isBlock(scalar) || scalar.value === '') {
                continue;
            }
            findings.push(
                finding('document-streams-written-as-block-scalars', lineOf(scalar), {
                    fix: `write ${key} as a block scalar (\`|\` keeps the final newline, \`|-\` drops it) — \`make fix\` re-styles it`,
                    found: `${key} written as a ${scalar.type === Scalar.PLAIN ? 'plain' : 'quoted'} scalar`,
                }),
            );
        }
    }
    return findings;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const REDUNDANT_WORDS = new Set(['cli', 'spec', 'test']);

function checkFileName(rel: string): Finding[] {
    const name = basename(rel);
    const caseName = name.slice(0, -SPEC_EXTENSION.length);
    const findings: Finding[] = [];
    if (!KEBAB.test(caseName)) {
        findings.push(
            finding('file-suffix-matches-place', 1, {
                fix: `rename it in kebab-case — lowercase words joined by single hyphens, \`<case>${SPEC_EXTENSION}\``,
                found: `"${name}" is not kebab-case`,
            }),
        );
        return findings;
    }
    const redundant = caseName.split('-').filter((word) => REDUNDANT_WORDS.has(word));
    if (redundant.length > 0) {
        findings.push(
            finding('file-suffix-matches-place', 1, {
                fix: `drop "${redundant[0]}" from the name and name the case it proves`,
                found: `"${name}" repeats "${redundant[0]}", which the \`${SPEC_EXTENSION}\` suffix already says`,
            }),
        );
    }
    const folder = basename(dirname(rel));
    if (caseName === folder) {
        findings.push(
            finding('file-suffix-matches-place', 1, {
                fix: 'name it for what this case proves, not where it sits',
                found: `"${name}" repeats its directory "${folder}/"`,
            }),
        );
    }
    return findings;
}

const MAX_DESCRIPTION = 100;
const SYMBOL_WORD = /^[A-Z0-9_]+$/u;

function checkDescription(document: SpecDocument): Finding[] {
    const findings: Finding[] = [];
    const text = document.description;
    const line = document.descriptionLine;
    const at = (found: string, fix: string): Finding =>
        finding('document-description-is-a-title', line, { fix, found });
    if (text.includes('\n')) {
        findings.push(
            at('a `description:` of several lines', 'write the vitest title on one line'),
        );
        return findings;
    }
    if (text.length > MAX_DESCRIPTION) {
        findings.push(
            at(
                `a \`description:\` of ${text.length} characters`,
                `shorten it under ${MAX_DESCRIPTION} characters — a title, not a paragraph`,
            ),
        );
    }
    if (text.endsWith('.')) {
        findings.push(
            at(
                'a `description:` ending with a period',
                'drop the period — a title is a fragment, not a sentence',
            ),
        );
    }
    const first = text.split(/\s+/u)[0] ?? '';
    if (/^[A-Z]/u.test(text) && !SYMBOL_WORD.test(first)) {
        findings.push(
            at(
                'a `description:` starting with a capital',
                `start it lowercase: "${text.charAt(0).toLowerCase()}${text.slice(1)}"`,
            ),
        );
    }
    return findings;
}

const VOLATILE = [
    {
        pattern: /\b(?:127\.0\.0\.1|localhost|0\.0\.0\.0):\d{2,5}\b/u,
        token: '{{url}} (or {{port}})',
    },
    { pattern: /(?:^|[\s"'(=])(?:\/private)?\/tmp\//u, token: '{{workdir}}' },
    { pattern: /(?:^|[\s"'(=])\/var\/folders\//u, token: '{{workdir}}' },
    { pattern: /(?:^|[\s"'(=])\/(?:Users|home)\/[^\s"'/]+\//u, token: '{{workdir}} or {{path}}' },
] as const;

/** A `{{token}}` is removed first: a path written after one is the token's tail, not a literal. */
/** A pattern matches the shape that makes a value volatile, so the carve-out looks up the whole word, or one pinned `/tmp/` would exempt every temp path. */
function wordAround(text: string, index: number): string {
    let start = index;
    let end = index;
    while (start > 0 && !/[\s"'(),;=]/u.test(text[start - 1] ?? '')) {
        start -= 1;
    }
    while (end < text.length && !/[\s"'(),;=]/u.test(text[end] ?? '')) {
        end += 1;
    }
    return text.slice(start, end);
}

export function volatileLiteralIn(
    line: string,
): undefined | { found: string; token: string; word: string } {
    const bare = line.replaceAll(/\{\{[^}]*\}\}/gu, ' ');
    for (const { pattern, token } of VOLATILE) {
        const found = pattern.exec(bare);
        if (found !== null) {
            const at = found.index + found[0].length - found[0].trimStart().length;
            return { found: found[0].trim(), token, word: wordAround(bare, at) };
        }
    }
    return undefined;
}

/** Unless the document fixed it, the carve-out `pinned-value-from-the-input` rests on: a value the document states rather than one the run minted. */
function checkVolatileLiterals(document: SpecDocument, dir: string): Finding[] {
    const findings: Finding[] = [];
    let fixed: null | string = null;
    for (const stream of assertedStreams(document)) {
        for (const [index, text] of stream.text.split('\n').entries()) {
            const volatileLiteral = volatileLiteralIn(text);
            if (volatileLiteral === undefined) {
                continue;
            }
            fixed ??= fixedData(document, dir);
            if (fixed.includes(volatileLiteral.word)) {
                continue;
            }
            findings.push(
                finding('no-volatile-literal', stream.line + index, {
                    fix: `write ${volatileLiteral.token} where "${volatileLiteral.found}" stands`,
                    found: `"${volatileLiteral.found}", a value the next run will not reproduce`,
                }),
            );
        }
    }
    return findings;
}

const ISO8601 = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/u;
const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/u;

/** A sibling `fixtures/` is the document's material whether or not a `fixture:` line names the exact file. */
function fixedData(document: SpecDocument, dir: string): string {
    const parts = document.runs.flatMap((run) => [run.stdin ?? '', run.command]);
    for (const token of document.env) {
        parts.push(token.kind === 'pair' ? `${token.key}=${token.value}` : token.name);
    }
    for (const entry of document.serve) {
        parts.push(entry.name, ...Object.values(entry.env));
    }
    const visit = (path: string): void => {
        const kind = treeKind(path);
        if (kind === undefined) {
            return;
        }
        if (kind === 'file') {
            parts.push(readText(path));
            return;
        }
        for (const entry of treeNames(path)) {
            visit(join(path, entry));
        }
    };
    for (const fixture of document.fixtures) {
        let source;
        try {
            source = resolveSpecPath('fixture', fixture.path, dir);
        } catch {
            continue;
        }
        visit(source);
    }
    visit(join(dir, GROUND_FIXTURES));
    return parts.join('\n');
}

function checkPinnedValues(document: SpecDocument, dir: string): Finding[] {
    const findings: Finding[] = [];
    const streams = assertedStreams(document);
    if (streams.length === 0) {
        return findings;
    }
    let fixed: null | string = null;
    for (const stream of streams) {
        for (const [index, text] of stream.text.split('\n').entries()) {
            for (const [pattern, token] of [
                [ISO8601, '{{iso8601}}'],
                [UUID, '{{uuid}}'],
            ] as const) {
                const found = pattern.exec(text);
                if (found === null) {
                    continue;
                }
                fixed ??= fixedData(document, dir);
                if (fixed.includes(found[0])) {
                    continue;
                }
                findings.push(
                    finding(
                        'pinned-value-from-the-input',
                        stream.line + index,
                        {
                            fix: `write ${token} where "${found[0]}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
                            found: `"${found[0]}", which no \`fixture:\` or \`stdin:\` of this document pins`,
                        },
                        'warn',
                    ),
                );
            }
        }
    }
    return findings;
}

function checkEmptyAssertions(document: SpecDocument): Finding[] {
    const findings: Finding[] = [];
    for (const stream of assertedStreams(document)) {
        if (
            stream.text.replaceAll('{{any}}', '').trim() === '' &&
            stream.text.includes('{{any}}')
        ) {
            findings.push(
                finding(
                    'no-empty-expected-stream',
                    stream.line,
                    {
                        fix: 'write what the command actually printed, tokens for what moves',
                        found: 'a stream that is only {{any}}',
                    },
                    'warn',
                ),
            );
        }
    }
    return findings;
}

function checkSilentRefusals(document: SpecDocument): Finding[] {
    return document.runs
        .filter((run) => run.exitCode !== 0 && run.stdout === null && run.stderr === null)
        .map((run) =>
            finding(
                'no-silent-refusal',
                run.commandLine,
                {
                    fix: 'write the words the refusal printed under `stderr:` (or `stdout:`)',
                    found: `\`exit: ${run.exitCode}\` with no \`stdout:\` and no \`stderr:\``,
                },
                'warn',
            ),
        );
}

/** Read by depth, not by parsing. */
function objectKeys(source: string, from: number): { end: number; keys: string[] } {
    const keys: string[] = [];
    let depth = 0;
    let quote = '';
    for (let index = from; index < source.length; index += 1) {
        const char = source[index] ?? '';
        if (quote !== '') {
            if (char === quote && source[index - 1] !== '\\') {
                quote = '';
            }
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{' || char === '[' || char === '(') {
            depth += 1;
            continue;
        }
        if (char === '}' || char === ']' || char === ')') {
            depth -= 1;
            if (depth === 0) {
                return { end: index, keys };
            }
            continue;
        }
        if (depth === 1 && /[A-Za-z_$'"]/u.test(char)) {
            const rest = /^(?<quote>['"]?)(?<name>[A-Za-z_$][\w$]*)\k<quote>\s*:/u.exec(
                source.slice(index),
            );
            const name = rest?.groups?.name;
            if (rest !== null && name !== undefined) {
                keys.push(name);
                index += rest[0].length - 1;
            }
        }
    }
    return { end: source.length, keys };
}

/** Nothing in a document says which neighbouring runner runs it, so their registries are read as a union. */
function registeredNames(dir: string): null | { env: Set<string>; serve: Set<string> } {
    let current = dir;
    for (;;) {
        let entries: string[];
        try {
            entries = treeNames(current).filter((name) => name.endsWith('.specification.ts'));
        } catch {
            entries = [];
        }
        if (entries.length > 0) {
            const env = new Set<string>();
            const serve = new Set<string>();
            for (const entry of entries) {
                const text = readText(join(current, entry));
                for (const call of text.matchAll(/specification\.cli\s*\(/gu)) {
                    const open = text.indexOf('{', call.index + call[0].length);
                    if (open === -1) {
                        continue;
                    }
                    const options = objectKeys(text, open);
                    for (const [key, into] of [
                        ['env', env],
                        ['serve', serve],
                    ] as const) {
                        const marker = new RegExp(String.raw`\b${key}\s*:\s*\{`, 'u').exec(
                            text.slice(open, options.end),
                        );
                        if (marker === null) {
                            continue;
                        }
                        const at = open + marker.index + marker[0].length - 1;
                        for (const name of objectKeys(text, at).keys) {
                            into.add(name);
                        }
                    }
                }
            }
            return { env, serve };
        }
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

function checkRegisteredNames(document: SpecDocument, dir: string): Finding[] {
    if (document.env.length === 0 && document.serve.length === 0) {
        return [];
    }
    const registered = registeredNames(dir);
    if (registered === null) {
        return [];
    }
    const findings: Finding[] = [];
    for (const token of document.env) {
        if (token.kind === 'set' && !registered.env.has(token.name)) {
            findings.push(
                finding('document-env-and-serve-registered', token.line, {
                    fix:
                        registered.env.size === 0
                            ? `register "${token.name}" in the \`env\` option of \`specification.cli(…)\`, or write the variable as \`NAME=value\``
                            : `name one of ${[...registered.env].sort().join(', ')}, or register "${token.name}" in \`specification.cli({ env })\``,
                    found: `env: "${token.name}", which no specification registers`,
                }),
            );
        }
    }
    for (const entry of document.serve) {
        if (!registered.serve.has(entry.name)) {
            findings.push(
                finding('document-env-and-serve-registered', entry.line, {
                    fix:
                        registered.serve.size === 0
                            ? `register "${entry.name}" in the \`serve\` option of \`specification.cli(…)\``
                            : `name one of ${[...registered.serve].sort().join(', ')}, or register "${entry.name}" in \`specification.cli({ serve })\``,
                    found: `serve: "${entry.name}", which no specification registers`,
                }),
            );
        }
    }
    return findings;
}

/** A document the grammar refuses yields nothing here: `document-follows-its-grammar` already reported it. */
export function checkSpecConventions(text: string, rel: string, path: string): TokenViolation[] {
    let file: SpecFile;
    try {
        file = readSpecFile(text, rel);
    } catch {
        return [];
    }
    const lineAt = (node: Pair<Node, Node> | Scalar): number => {
        const range = 'range' in node && Array.isArray(node.range) ? node.range : undefined;
        const { key } = node as Pair<Node, Node>;
        const target = range ?? (isScalar(key) && Array.isArray(key.range) ? key.range : undefined);
        return target === undefined ? 1 : file.source.lineAt(target[0]);
    };
    const dir = dirname(path);
    const findings = [
        ...checkKeyOrder(file, (pair) => lineAt(pair.key as unknown as Scalar)),
        ...checkBlockScalars(file, (scalar) => lineAt(scalar)),
        ...checkFileName(rel),
        ...checkDescription(file.document),
        ...checkVolatileLiterals(file.document, dir),
        ...checkPinnedValues(file.document, dir),
        ...checkEmptyAssertions(file.document),
        ...checkSilentRefusals(file.document),
        ...checkRegisteredNames(file.document, dir),
    ];
    return findings.map(({ fix, found, line, rule, severity }) => ({
        file: rel,
        fix,
        found,
        line,
        rule,
        severity,
    }));
}

export function checkSpecDescriptionsUnique(rootDir: string): TokenViolation[] {
    const byDirectory = new Map<string, Map<string, string>>();
    const violations: TokenViolation[] = [];
    for (const path of listSpecFiles(rootDir)) {
        let document;
        try {
            document = readSpecFile(readText(path), path).document;
        } catch {
            continue;
        }
        const dir = dirname(path);
        const seen = byDirectory.get(dir) ?? new Map<string, string>();
        byDirectory.set(dir, seen);
        const first = seen.get(document.description);
        const rel = relative(rootDir, path);
        if (first === undefined) {
            seen.set(document.description, rel);
            continue;
        }
        violations.push({
            file: rel,
            line: document.descriptionLine,
            fix: `retitle one of the two for what it proves apart from the other`,
            found: `"${document.description}", already the description of ${first}`,
            rule: 'document-description-unique',
            severity: 'error',
        });
    }
    return violations;
}

function reorder(map: YAMLMap, order: readonly string[]): void {
    const known = pairsOf(map).filter((pair) => order.includes(keyName(pair) ?? ''));
    const sorted = [...known].sort(
        (a, b) => order.indexOf(keyName(a)!) - order.indexOf(keyName(b)!),
    );
    let cursor = 0;
    map.items = pairsOf(map).map(
        (pair) => (order.includes(keyName(pair) ?? '') ? sorted[cursor++] : pair) ?? pair,
    );
}

/** `null` when nothing moved: the caller writes only what changed, so a clean tree keeps its mtimes. */
export function fixSpecDocument(text: string, rel: string): null | string {
    let file: SpecFile;
    try {
        file = readSpecFile(text, rel);
    } catch {
        return null;
    }
    const map = documentMap(file);
    if (map === null) {
        return null;
    }
    reorder(map, DOCUMENT_KEYS);
    for (const run of runMaps(file)) {
        reorder(run, RUN_KEYS);
        for (const { scalar } of streamScalars(run)) {
            if (!isBlock(scalar) && scalar.value !== '') {
                scalar.type = Scalar.BLOCK_LITERAL;
            }
        }
    }
    const next = renderYamlSource(file.source);
    return next === text ? null : next;
}

export function fixSpecFiles(rootDir: string): string[] {
    const written: string[] = [];
    for (const path of listSpecFiles(rootDir)) {
        const text = readText(path);
        const next = fixSpecDocument(text, relative(rootDir, path));
        if (next !== null) {
            writeFileSync(path, next);
            written.push(relative(rootDir, path));
        }
    }
    return written;
}
