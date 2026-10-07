import { GROUND_FIXTURES, isGroundFolder } from '@jterrazz/typescript/rules';

import { isRelativePath } from './relative-path.js';
import { FILE_CONTENT_KEYS, FILE_STATES, RUN_KEYS, SpecSyntaxError } from './spec-grammar.js';
import type {
    SpecEnvToken,
    SpecFileAssertion,
    SpecFixture,
    SpecRun,
    SpecServeEntry,
    SpecStream,
} from './spec-grammar.js';
import {
    closedPairs,
    contentLine,
    fail,
    holdPresence,
    keyed,
    lineOf,
    requireInteger,
    requireMap,
    requireString,
    scalarString,
    stringList,
} from './spec-node.js';
import type { Context } from './spec-node.js';
import { isSeq, nodeItems, nodePairs } from './yaml-document.js';
import type { Node } from './yaml-document.js';

function readStream(context: Context, node: Node | null, what: string): SpecStream {
    return { line: contentLine(context, node), text: requireString(context, node, what) };
}

export function readEnv(context: Context, node: Node | null): SpecEnvToken[] {
    return stringList(context, node, 'env:').map(({ line, value }) => {
        const separator = value.indexOf('=');
        if (separator === -1) {
            return { kind: 'set', line, name: value } as const;
        }
        if (separator === 0) {
            throw new SpecSyntaxError(
                context.fileName,
                line,
                `env: "${value}" has no variable name before the "="`,
            );
        }
        return {
            key: value.slice(0, separator),
            kind: 'pair',
            line,
            value: value.slice(separator + 1),
        } as const;
    });
}

function readServeEntry(context: Context, node: Node | null): SpecServeEntry {
    const name = scalarString(node);
    if (name !== null) {
        return { env: {}, line: lineOf(context, node), name };
    }
    const map = requireMap(context, node, 'a serve: entry');
    if (map.items.length !== 1) {
        fail(context, node, 'a serve: entry names ONE server: `- <name>: { KEY: value }`');
    }
    const [pair] = nodePairs(map);
    // Stryker disable next-line ConditionalExpression: the one item of a parsed map is a pair
    if (pair === undefined) {
        fail(context, node, 'a serve: entry names ONE server: `- <name>: { KEY: value }`');
    }
    const serverName = scalarString(pair.key);
    if (serverName === null) {
        fail(context, pair, 'a serve: entry must name its server with a plain word');
    }
    const env: Record<string, string> = {};
    const envMap = requireMap(context, pair.value, `serve: ${serverName}`);
    for (const entry of nodePairs(envMap)) {
        const key = scalarString(entry.key);
        if (key === null) {
            fail(context, entry, `serve: ${serverName} — a variable name must be a plain word`);
        }
        env[key] = requireString(context, entry.value, `serve: ${serverName}.${key}`);
    }
    return { env, line: lineOf(context, pair), name: serverName };
}

export function readServe(context: Context, node: Node | null): SpecServeEntry[] {
    const items: (Node | null)[] = isSeq(node) ? nodeItems(node) : [node];
    return items.map((item) => readServeEntry(context, item));
}

function readFiles(context: Context, node: Node | null): SpecFileAssertion[] {
    const map = requireMap(context, node, 'files:');
    return nodePairs(map).map((pair) => {
        const path = scalarString(pair.key);
        if (path === null) {
            fail(context, pair, 'files: each key is a path relative to the working directory');
        }
        const line = lineOf(context, pair);
        const state = scalarString(pair.value);
        if (state !== null) {
            const kind = FILE_STATES.find((known) => known === state);
            if (kind === undefined) {
                fail(
                    context,
                    pair,
                    `files: "${path}: ${state}" is not a state — write ${FILE_STATES.join(' or ')}, or a { ${FILE_CONTENT_KEYS.join(', ')} } assertion`,
                );
            }
            return { kind, line, path };
        }
        const assertion = requireMap(context, pair.value, `files: ${path}`);
        const pairs = closedPairs(context, assertion, FILE_CONTENT_KEYS, `files: ${path}`);
        holdPresence(context, keyed(pairs), { line, shape: 'files', subject: path });
        const contains: SpecStream[] = [];
        let equals: null | SpecStream = null;
        for (const entry of pairs) {
            if (scalarString(entry.key) === 'contains') {
                if (isSeq(entry.value)) {
                    for (const item of nodeItems(entry.value)) {
                        contains.push(readStream(context, item, `files: ${path}.contains`));
                    }
                } else {
                    contains.push(readStream(context, entry.value, `files: ${path}.contains`));
                }
                continue;
            }
            equals = readStream(context, entry.value, `files: ${path}.equals`);
        }
        return { contains, equals, kind: 'content', line, path };
    });
}

export function readRun(context: Context, node: Node | null, isLast: boolean): SpecRun {
    const map = requireMap(context, node, 'each entry of runs:');
    const found = keyed(closedPairs(context, map, RUN_KEYS, 'a run'));
    holdPresence(context, found, { line: lineOf(context, node), shape: 'run' });

    const commandPair = found.get('command');
    const exitPair = found.get('exit');
    // Stryker disable next-line ConditionalExpression,LogicalOperator: holdPresence refused a run missing either
    if (commandPair === undefined || exitPair === undefined) {
        fail(context, node, 'a run states its command: and its exit:');
    }
    const command = requireString(context, commandPair.value, 'command:');
    const waitForPair = found.get('waitFor');
    if (waitForPair !== undefined && !isLast) {
        fail(
            context,
            waitForPair,
            'waitFor: is only allowed on the LAST run — a long-running command ends the session',
        );
    }

    const stdout = found.get('stdout');
    const stderr = found.get('stderr');
    const stdin = found.get('stdin');
    const timeout = found.get('timeout');
    const files = found.get('files');
    return {
        command,
        commandLine: lineOf(context, commandPair),
        exitCode: requireInteger(context, exitPair.value, 'exit:'),
        files: files === undefined ? [] : readFiles(context, files.value),
        stderr: stderr === undefined ? null : readStream(context, stderr.value, 'stderr:'),
        stdin: stdin === undefined ? null : requireString(context, stdin.value, 'stdin:'),
        stdout: stdout === undefined ? null : readStream(context, stdout.value, 'stdout:'),
        timeout: timeout === undefined ? null : requireInteger(context, timeout.value, 'timeout:'),
        waitFor:
            waitForPair === undefined
                ? null
                : requireString(context, waitForPair.value, 'waitFor:'),
    };
}

function groundOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundFolder(segment));
}

/** A fixture is laid from `__fixtures__/`, a file or a whole directory. */
export function readFixtures(context: Context, node: Node | null): SpecFixture[] {
    return stringList(context, node, 'fixture:').map(({ line, value }) => {
        if (!isRelativePath(value)) {
            throw new SpecSyntaxError(
                context.fileName,
                line,
                `fixture: "${value}" is not a relative path — name it from this document (./… or ../…)`,
            );
        }
        const found = groundOf(value);
        if (found !== GROUND_FIXTURES) {
            const where = `./${GROUND_FIXTURES}/ beside the document, or in the ${GROUND_FIXTURES}/ of the lowest folder the leaves share (specs/${GROUND_FIXTURES}/ across specifications)`;
            throw new SpecSyntaxError(
                context.fileName,
                line,
                `fixture: reads ${GROUND_FIXTURES}/, and "${value}" names ${found === undefined ? `no ${GROUND_FIXTURES}/ folder` : `${found}/`} — put the file in ${where} (verb-reads-its-ground-folder)`,
            );
        }
        return { line, path: value };
    });
}
