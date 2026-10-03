import { isNode, LineCounter, parseDocument, Scalar, visit } from 'yaml';
import type { CollectionTag, Document, Node, Pair, ScalarTag, YAMLMap, YAMLSeq } from 'yaml';

export { isMap, isNode, isPair, isScalar, isSeq, Scalar } from 'yaml';
export type { Document, Node, Pair, YAMLMap, YAMLSeq } from 'yaml';

export function nodePairs(map: YAMLMap): Pair<Node, Node>[] {
    return map.items.filter(
        (pair): pair is Pair<Node, Node> =>
            isNode(pair.key) && (pair.value === null || isNode(pair.value)),
    );
}

export function nodeItems(seq: YAMLSeq): Node[] {
    return seq.items.filter((item): item is Node => isNode(item));
}

export type YamlSource = {
    document: Document.Parsed;
    indent: number;
    lineAt: (offset: number) => number;
    text: string;
};

/** A mapping key line or a flow list entry, never block-scalar text. */
const KEY_LINE = /^(?<indent> +)(?:(?:- )?[A-Za-z_$'"][^\n]*:|- [[{])/u;

function detectIndent(text: string): number {
    let smallest = 0;
    for (const line of text.split('\n')) {
        const indent = KEY_LINE.exec(line)?.groups?.indent;
        if (indent !== undefined && (smallest === 0 || indent.length < smallest)) {
            smallest = indent.length;
        }
    }
    return smallest === 0 ? 2 : smallest;
}

const STRING_TAG = 'tag:yaml.org,2002:str';

/** An indentation indicator is ONE digit, so nine spaces is the deepest step statable. */
const DEEPEST_STATABLE_STEP = 9;

type StringifyContext = Parameters<NonNullable<ScalarTag['stringify']>>[1];

/** The `yaml` writer always writes `|2`, whatever the step; a four-space document then reads back two spaces short. */
function stateIndentation(written: string, ctx: StringifyContext): string {
    if (!/^[|>][1-9]/u.test(written)) {
        return written;
    }
    const step = ctx.indent === '' ? 1 : ctx.indentStep.length;
    if (step > DEEPEST_STATABLE_STEP) {
        throw new Error(
            `A block scalar indented by ${step} spaces cannot state its indentation: YAML writes that indicator as a single digit, so ${DEEPEST_STATABLE_STEP} spaces is the deepest step a document may be written with.`,
        );
    }
    return `${written[0]}${step}${written.slice(2)}`;
}

function isScalarTag(tag: CollectionTag | ScalarTag | string): tag is ScalarTag {
    return typeof tag !== 'string' && tag.collection === undefined;
}

function statingItsIndentation(tag: ScalarTag): ScalarTag {
    const write = tag.stringify;
    if (write === undefined) {
        return tag;
    }
    return {
        ...tag,
        stringify: (item, ctx, onComment, onChompKeep) =>
            stateIndentation(write(item, ctx, onComment, onChompKeep), ctx),
    };
}

export type YamlSyntaxError = {
    line: number;
    message: string;
};

export function parseYamlSource(text: string): YamlSource {
    const lineCounter = new LineCounter();
    const document = parseDocument(text, {
        customTags: (tags) =>
            tags.map((tag) =>
                isScalarTag(tag) && tag.tag === STRING_TAG ? statingItsIndentation(tag) : tag,
            ),
        keepSourceTokens: true,
        lineCounter,
    });
    return {
        document,
        indent: detectIndent(text),
        lineAt: (offset) => lineCounter.linePos(offset).line,
        text,
    };
}

export function yamlSyntaxErrors(source: YamlSource): YamlSyntaxError[] {
    return source.document.errors.map((error) => ({
        line: error.linePos?.[0]?.line ?? source.lineAt(error.pos[0]),
        message: error.message,
    }));
}

export function blockScalar(text: string): Scalar<string> {
    const scalar = new Scalar(text);
    scalar.type = Scalar.BLOCK_LITERAL;
    return scalar;
}

/** Its span starts at the whitespace before it: a spelling broken over lines begins with a newline the writer would not write. */
type FlowCollection = {
    ownerIndent: number;
    range: [number, number];
    text: string;
    value: string;
};

function lineStart(text: string, offset: number): number {
    return text.lastIndexOf('\n', offset - 1) + 1;
}

function afterOwner(text: string, offset: number): number {
    let at = offset;
    while (at > 0 && /\s/u.test(text[at - 1] ?? '')) {
        at -= 1;
    }
    return at;
}

function indentOf(text: string, offset: number): number {
    const start = lineStart(text, offset);
    return /^ */u.exec(text.slice(start))![0].length;
}

/** Outermost only: a nested one is restored with its parent, and descending would splice it twice. */
function flowCollections(text: string): FlowCollection[] {
    const found: FlowCollection[] = [];
    const take = (node: { flow?: boolean; range?: null | number[]; toJSON: () => unknown }) => {
        if (node.flow !== true || !node.range) {
            return;
        }
        const [start, end] = node.range;
        if (start === undefined || end === undefined) {
            return;
        }
        const from = afterOwner(text, start);
        found.push({
            ownerIndent: indentOf(text, from === 0 ? 0 : from - 1),
            range: [from, end],
            text: text.slice(from, end),
            value: JSON.stringify(node.toJSON()),
        });
        return visit.SKIP;
    };
    visit(parseDocument(text), {
        Map: (_key, node) => take(node),
        Seq: (_key, node) => take(node),
    });
    return found;
}

/** The `yaml` writer's flow style is not oxfmt's: re-emitting an untouched collection makes `check --fix` and `oxfmt` rewrite each other for ever. */
function restoreUntouchedFlow(rendered: string, text: string): string {
    const sources = flowCollections(text);
    if (sources.length === 0) {
        return rendered;
    }
    const taken = new Set<number>();
    const splices: { range: [number, number]; text: string }[] = [];
    for (const target of flowCollections(rendered)) {
        const at = sources.findIndex(
            (candidate, index) =>
                !taken.has(index) &&
                candidate.value === target.value &&
                candidate.ownerIndent === target.ownerIndent,
        );
        if (at === -1) {
            continue;
        }
        const source = sources[at];
        if (source === undefined) {
            continue;
        }
        taken.add(at);
        splices.push({ range: target.range, text: source.text });
    }
    let out = rendered;
    for (const splice of splices.toReversed()) {
        out = out.slice(0, splice.range[0]) + splice.text + out.slice(splice.range[1]);
    }
    return out;
}

/** `lineWidth: 0`: a golden is compared byte for byte, so nothing folds a long line. */
export function renderYamlSource(source: YamlSource): string {
    const rendered = source.document.toString({ indent: source.indent, lineWidth: 0 });
    return restoreUntouchedFlow(rendered, source.text);
}
