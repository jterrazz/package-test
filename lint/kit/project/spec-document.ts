import { readEnv, readFixtures, readRun, readServe } from './spec-fields.js';
import { DOCUMENT_KEYS, SpecSyntaxError } from './spec-grammar.js';
import type { SpecDocument, SpecFile, SpecStream } from './spec-grammar.js';
import {
    closedPairs,
    fail,
    held,
    holdPresence,
    keyed,
    lineOf,
    requireMap,
    requireString,
} from './spec-node.js';
import type { Context } from './spec-node.js';
import { isScalar, isSeq, nodeItems, parseYamlSource, yamlSyntaxErrors } from './yaml-document.js';
import type { Node, Pair } from './yaml-document.js';

/** The grammar alone: no path resolution, no command, no filesystem. The runner, the lint checker and the JSON Schema read the same constants. */

/** `fileName` is used verbatim in refusals. Update mode rewrites the returned YAML source, never a re-serialisation. */
export function readSpecFile(content: string, fileName: string): SpecFile {
    const source = parseYamlSource(content);
    const [syntax] = yamlSyntaxErrors(source);
    if (syntax !== undefined) {
        throw new SpecSyntaxError(fileName, syntax.line, syntax.message);
    }
    const context: Context = { fileName, source };
    const root = source.document.contents;
    if (root === null || (isScalar(root) && root.value === null)) {
        throw new SpecSyntaxError(fileName, 1, 'the document is empty');
    }
    const map = requireMap(context, root, 'a spec document');
    const found = keyed(closedPairs(context, map, DOCUMENT_KEYS, 'a spec document'));
    holdPresence(context, found, { line: lineOf(context, map), shape: 'document' });
    const document: SpecDocument = {
        description: requireString(context, held(found, 'description').value, 'description:'),
        descriptionLine: lineOf(context, found.get('description')),
        ...readCliFields(context, found),
    };
    return { document, source };
}

function readCliFields(
    context: Context,
    found: ReadonlyMap<string, Pair<Node, Node>>,
): Pick<SpecDocument, 'env' | 'fixtures' | 'runs' | 'serve'> {
    const runsNode = held(found, 'runs');
    if (!isSeq(runsNode.value) || runsNode.value.items.length === 0) {
        fail(context, runsNode, 'runs: is a list of at least one run');
    }
    const runItems = nodeItems(runsNode.value);
    const fixturePair = found.get('fixture');
    const envPair = found.get('env');
    const servePair = found.get('serve');
    return {
        env: envPair === undefined ? [] : readEnv(context, envPair.value),
        fixtures: fixturePair === undefined ? [] : readFixtures(context, fixturePair.value),
        runs: runItems.map((item, index) => readRun(context, item, index === runItems.length - 1)),
        serve: servePair === undefined ? [] : readServe(context, servePair.value),
    };
}

/** `stdin:` is an input and a description or command is prose: none appears here. */
export function assertedStreams(document: SpecDocument): SpecStream[] {
    const streams: SpecStream[] = [];
    for (const run of document.runs) {
        if (run.stdout !== null) {
            streams.push(run.stdout);
        }
        if (run.stderr !== null) {
            streams.push(run.stderr);
        }
        for (const assertion of run.files) {
            if (assertion.kind !== 'content') {
                continue;
            }
            streams.push(...assertion.contains);
            if (assertion.equals !== null) {
                streams.push(assertion.equals);
            }
        }
    }
    return streams;
}

export type DocumentPath = {
    key: 'fixture';
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

export function documentPaths(document: SpecDocument): DocumentPath[] {
    return document.fixtures.map(({ line, path }) => ({
        key: 'fixture',
        kind: path.endsWith('/') ? 'directory' : 'file',
        line,
        path,
    }));
}

export function parseSpecDocument(content: string, fileName: string): SpecDocument {
    return readSpecFile(content, fileName).document;
}
