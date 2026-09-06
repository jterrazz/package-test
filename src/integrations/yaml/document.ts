import {
    type CollectionTag,
    type Document,
    LineCounter,
    parseDocument,
    Scalar,
    type ScalarTag,
    visit,
} from 'yaml';

/**
 * The `yaml` dependency, wrapped once.
 *
 * Everything that reads or writes a YAML DOCUMENT — as opposed to a plain
 * value — goes through here: the `.spec.yaml` grammar, and the lint passes that
 * judge its shape. The document form is what update mode needs, because it is
 * the only one that survives a round trip: comments, key order and block-scalar
 * styles come back as they were written, so a rewrite touches the streams it
 * refreshed and nothing else. The one thing the writer restyles on its own —
 * a flow collection — is put back from the source by {@link renderYamlSource}.
 *
 * The node types and guards are re-exported rather than imported by each
 * consumer: one folder owns one external dependency (CONVENTIONS I1), and this
 * is that folder.
 */

export { isMap, isPair, isScalar, isSeq, Scalar } from 'yaml';
export type { Document, Node, Pair, YAMLMap, YAMLSeq } from 'yaml';

/** A parsed YAML file, plus the offset → line map its diagnostics need. */
export interface YamlSource {
    document: Document.Parsed;
    /** The file's own indentation step, so a rewrite comes back in its style. */
    indent: number;
    /** 1-based line of a source offset. */
    lineAt: (offset: number) => number;
    /** The text it was parsed from — what a rewrite gives back where it changed nothing. */
    text: string;
}

/** A line that opens a mapping key — `  key:` or `  - key:`, never block-scalar text. */
const KEY_LINE = /^(?<indent> +)(?:- )?[A-Za-z_$'"][^\n]*:/;

/**
 * The indentation step the file was written with, read from the shallowest
 * mapping key it carries. A rewrite must come back in the author's style — a
 * formatter that indents by four and a writer that indents by two would fight
 * over every updated document. Two is YAML's own default, and the fallback.
 */
function detectIndent(text: string): number {
    let smallest = 0;
    for (const line of text.split('\n')) {
        const found = KEY_LINE.exec(line);
        if (found?.groups && (smallest === 0 || found.groups.indent.length < smallest)) {
            smallest = found.groups.indent.length;
        }
    }
    return smallest === 0 ? 2 : smallest;
}

// ── The indentation a block scalar states ──

/** The tag every string goes out through — key, plain value and block scalar alike. */
const STRING_TAG = 'tag:yaml.org,2002:str';

/** An indentation indicator is ONE digit, so nine spaces is the deepest step statable. */
const DEEPEST_STATABLE_STEP = 9;

/** What the `yaml` writer hands a tag: where the node lands, and the step it lands by. */
type StringifyContext = Parameters<NonNullable<ScalarTag['stringify']>>[1];

/**
 * Restate a block scalar's indentation indicator from the indentation its
 * content is actually written at.
 *
 * A block scalar whose first line opens on a space NEEDS that indicator: without
 * it a reader takes the space for indentation and gives back a string shorter
 * than the one that was written. The `yaml` writer knows when one is called for
 * and adds it — but it always writes the digit `2`, its own default step, never
 * the step it was asked to indent with. In a four-space document (oxfmt formats
 * YAML at four) `|2` puts every line back two spaces short, so the golden update
 * mode just wrote fails on its very next run.
 *
 * The digit belongs to the block, not to the writer's default: content sits one
 * step below its key, so the file's step is what the indicator names — and `1`
 * at the root, which YAML counts from -1.
 */
function stateIndentation(written: string, ctx: StringifyContext): string {
    if (!/^[|>][1-9]/.test(written)) {
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

/** A scalar tag among the schema's, told from a collection one by what it may hold. */
function isScalarTag(tag: CollectionTag | ScalarTag | string): tag is ScalarTag {
    return typeof tag !== 'string' && tag.collection === undefined;
}

/** The string tag, wrapped so every block scalar it writes states its own indentation. */
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

/** One refusal from the YAML parser itself, before any grammar is applied. */
export interface YamlSyntaxError {
    line: number;
    message: string;
}

/** Parse a YAML file into its document form, keeping comments and key order. */
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

/** The YAML parser's own errors, with their line — an empty list when it parsed. */
export function yamlSyntaxErrors(source: YamlSource): YamlSyntaxError[] {
    return source.document.errors.map((error) => ({
        line: error.linePos?.[0]?.line ?? source.lineAt(error.pos[0]),
        message: error.message,
    }));
}

/**
 * A literal block scalar. The `yaml` writer picks the chomping indicator from
 * the value itself — `|` when the text ends with a newline, `|-` when it does
 * not — and decides whether an indentation indicator is called for, which is
 * when the first line opens on a space. What that indicator SAYS is restated on
 * the way out by `stateIndentation` above, and together the two are the
 * byte-exactness the format promises.
 */
export function blockScalar(text: string): Scalar<string> {
    const scalar = new Scalar(text);
    scalar.type = Scalar.BLOCK_LITERAL;
    return scalar;
}

// ── What a rewrite leaves alone ──

/**
 * One flow collection as a file spells it. The span starts at the WHITESPACE
 * that separates it from the key or dash above it, because a spelling broken
 * over several lines begins with the newline the writer would not have written.
 */
interface FlowCollection {
    /** The indentation of the line its owner — the key, or the dash — sits on. */
    ownerIndent: number;
    range: [number, number];
    text: string;
    /** The value it holds, which is what makes two spellings the SAME collection. */
    value: string;
}

/** The first offset of the line `offset` sits on. */
function lineStart(text: string, offset: number): number {
    return text.lastIndexOf('\n', offset - 1) + 1;
}

/** Back over the whitespace before `offset`, to just past the `:` or `-` that owns it. */
function afterOwner(text: string, offset: number): number {
    let at = offset;
    while (at > 0 && /\s/.test(text[at - 1])) {
        at -= 1;
    }
    return at;
}

/** How many spaces a line opens with. */
function indentOf(text: string, offset: number): number {
    const start = lineStart(text, offset);
    return /^ */.exec(text.slice(start))![0].length;
}

/**
 * Every OUTERMOST flow collection of a document, in source order. A nested one
 * is part of its parent's text and is restored with it, so descending past a
 * flow collection would splice the same span twice.
 */
function flowCollections(text: string): FlowCollection[] {
    const found: FlowCollection[] = [];
    const take = (node: { flow?: boolean; range?: null | number[]; toJSON: () => unknown }) => {
        if (node.flow !== true || !node.range) {
            return undefined;
        }
        const from = afterOwner(text, node.range[0]);
        found.push({
            ownerIndent: indentOf(text, from === 0 ? 0 : from - 1),
            range: [from, node.range[1]],
            text: text.slice(from, node.range[1]),
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

/**
 * Give every flow collection the rewrite did not change back exactly as it was
 * written — padding, quotes and line breaks included.
 *
 * The `yaml` writer has ONE house style for `{ … }` and `[ … ]`, and it is not
 * the repository formatter's: oxfmt pads a flow mapping and not a flow sequence,
 * and explodes a long one over several lines, while the writer emits `[ 'a' ]`
 * on one line whatever its width. Re-emitting an untouched collection therefore
 * hands the formatter something to undo, and `check --fix` and `oxfmt` rewrite
 * each other for ever. A collection nobody touched belongs to its author, not to
 * either tool.
 *
 * A rendered collection is matched to a source one by VALUE and by the
 * INDENTATION of the line that owns it: the same content under the same key is
 * the same collection, and the indentation guard is what keeps the inner lines
 * of a multi-line spelling true where a fix moved that key. Anything unmatched
 * — added, removed, edited — keeps the writer's rendering.
 */
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
        taken.add(at);
        splices.push({ range: target.range, text: sources[at].text });
    }
    let out = rendered;
    for (const splice of splices.toReversed()) {
        out = out.slice(0, splice.range[0]) + splice.text + out.slice(splice.range[1]);
    }
    return out;
}

/**
 * Render a document back to text, in the indentation it was read with.
 * `lineWidth: 0` disables the folding of long lines — a golden is compared byte
 * for byte, so nothing may decide on its own where to break one.
 *
 * What the caller did not change comes back as it was written — see
 * {@link restoreUntouchedFlow} for the one construct the writer restyles.
 */
export function renderYamlSource(source: YamlSource): string {
    const rendered = source.document.toString({ indent: source.indent, lineWidth: 0 });
    return restoreUntouchedFlow(rendered, source.text);
}
