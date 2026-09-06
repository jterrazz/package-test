import { type Document, LineCounter, parseDocument, Scalar } from 'yaml';

/**
 * The `yaml` dependency, wrapped once.
 *
 * Everything that reads or writes a YAML DOCUMENT — as opposed to a plain
 * value — goes through here: the `.spec.yaml` grammar, and the lint passes that
 * judge its shape. The document form is what update mode needs, because it is
 * the only one that survives a round trip: comments, key order and block-scalar
 * styles come back as they were written, so a rewrite touches the streams it
 * refreshed and nothing else.
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

/** One refusal from the YAML parser itself, before any grammar is applied. */
export interface YamlSyntaxError {
    line: number;
    message: string;
}

/** Parse a YAML file into its document form, keeping comments and key order. */
export function parseYamlSource(text: string): YamlSource {
    const lineCounter = new LineCounter();
    const document = parseDocument(text, { keepSourceTokens: true, lineCounter });
    return {
        document,
        indent: detectIndent(text),
        lineAt: (offset) => lineCounter.linePos(offset).line,
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
 * not — and adds the indentation indicator (`|2`) when the first line starts
 * with a space, which is exactly the byte-exactness the format promises.
 */
export function blockScalar(text: string): Scalar<string> {
    const scalar = new Scalar(text);
    scalar.type = Scalar.BLOCK_LITERAL;
    return scalar;
}

/**
 * Render a document back to text, in the indentation it was read with.
 * `lineWidth: 0` disables the folding of long lines — a golden is compared byte
 * for byte, so nothing may decide on its own where to break one.
 */
export function renderYamlSource(source: YamlSource): string {
    return source.document.toString({ indent: source.indent, lineWidth: 0 });
}
