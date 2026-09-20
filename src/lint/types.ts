/**
 * Local structural types for the slice of oxlint's JS-plugin API this layer uses.
 *
 * oxlint 1.74 does not publicly export its `Plugin` / `Rule` / `Context` types
 * (only `RuleTester`, from `oxlint/plugins-dev`), so we describe the exact subset
 * we depend on here. Declaring them locally keeps the rules layer importing
 * NOTHING from the framework runtime — only these ambient shapes and, where a
 * rule needs it, pure helpers from `specification/` (e.g. the token list, the kebab-case
 * utilities). The API is ESLint-compatible, so these shapes mirror ESTree.
 */

/** A source comment, as exposed by oxlint's ESTree-compatible `sourceCode`. */
export type Comment = {
    end?: number;
    range?: [number, number];
    start?: number;
    type: 'Block' | 'Line' | 'Shebang';
    value: string;
};

/**
 * Minimal AST node. Rules narrow by `type` and read known fields defensively —
 * the full generated node union is not re-exported, and structural access keeps
 * the layer decoupled from oxlint's internal type churn.
 */
export type AstNode = {
    type: string;
    [key: string]: unknown;
};

/** The slice of `context.sourceCode` the rules read. */
export type SourceCode = {
    getAllComments: () => Comment[];
    getCommentsInside: (node: AstNode) => Comment[];
    text: string;
};

/** A diagnostic accepted by `context.report`. */
export type Diagnostic = {
    data?: Record<string, number | string> | undefined;
    messageId?: string | undefined;
    message?: string | undefined;
    node?: AstNode | undefined;
};

/** Rule context passed to `create`. */
export type RuleContext = {
    filename: string;
    id: string;
    /** Configured rule options (`['error', …options]` minus the severity). */
    options: readonly unknown[];
    physicalFilename: string;
    report: (diagnostic: Diagnostic) => void;
    sourceCode: SourceCode;
};

/** A visitor: node-type keys → handlers invoked on entry. */
export type Visitor = Record<string, (node: AstNode) => void>;

/**
 * The normative documentation a rule carries — the code is the source of truth
 * for the mechanized catalogue (docs-as-code inversion). Every plugin rule sets
 * `meta.docs` to its {@link RuleDoc} entry from `manifest.ts`; the catalogue
 * generator reads these to (re)write `docs/13-linting.md` and the annex.
 */
export type RuleDoc = {
    /**
     * Enforcement channel — ONE per row, and the row says which.
     *
     * A convention enforced two ways is two rows, because the two answer
     * different questions: what `statique` sees in one file is not what
     * `checker` sees across a tree, and neither is what `runtime` refuses.
     * Writing a single row with two channels made the catalogue unable to say
     * which pass a reader should expect a finding from.
     *
     * - `statique` — a `jterrazz/*` oxlint rule;
     * - `upstream` — an option this vocabulary sets on an oxlint plugin rule
     *   someone else owns (ADR-005);
     * - `checker` — a pass of `dist/checker.js`, over a tree or a member;
     * - `runtime` — a refusal the framework raises while a spec runs;
     * - `type` — what the compiler refuses, proven by a `test-d` assertion;
     * - `meta` — what one of the package's own meta-tests holds;
     * - `process` — a review judgement no channel can decide.
     */
    channel: 'checker' | 'meta' | 'process' | 'runtime' | 'statique' | 'type' | 'upstream';
    /** The normative sentence — the constitution's per-rule text, moved here. */
    convention: string;
    /**
     * One imperative line: what to DO about it. A ban with no destination is an
     * argument rather than a rule, so the catalogue and the message carry the
     * same fix.
     */
    fix: string;
    /**
     * The specification facet the rule guards — segments the catalogue like
     * the constructors segment the API. `'shared'` for cross-facet rules.
     */
    facet?: 'api' | 'cli' | 'component' | 'integration' | 'jobs' | 'mobile' | 'shared' | 'website';
    /** Convention family letter, e.g. `'A'`. */
    family: string;
    /** Convention code, e.g. `'A1'`. */
    id: string;
    /** One line: why the rule exists. */
    rationale: string;
    /**
     * For an `upstream` row: the rule whose OPTION carries the convention
     * (`vitest/no-restricted-matchers`). It is what the completeness meta-test
     * reads, so a row of that channel names the option it rests on.
     */
    upstream?: string;
    /**
     * Which files the rule looks at — the vocabulary of `roleOf` plus the
     * shapes that are not a role: `tests` (every file that declares tests),
     * `specs` (a tree), `member` (a package), and `all`.
     *
     * `module` is the COLOCATED unit test — a `.test.ts` beside the module it
     * covers, outside every specs tree. A `module`-role file under `specs/` is
     * a repository suite: it covers a tree rather than a unit, and the passes
     * that judge a tree are the ones that reach it.
     *
     * Required, like `fix`: a reader deciding whether a rule applies to the
     * file in front of them should not have to read its implementation, and a
     * row that left it blank was answering "somewhere".
     */
    reach:
        | 'all'
        | 'component'
        | 'config'
        | 'contract'
        | 'document'
        | 'ground'
        | 'member'
        | 'module'
        | 'spec'
        | 'specification'
        | 'specs'
        | 'tests';
};

/** Rule metadata (the subset we set). */
export type RuleMeta = {
    defaultOptions?: unknown[];
    docs?: RuleDoc & { description?: string };
    messages?: Record<string, string>;
    /** JSON schema for options — required by oxlint for rules that take options. */
    schema?: false | unknown[];
    type?: 'layout' | 'problem' | 'suggestion';
};

/** A lint rule in oxlint's `create` form. */
export type LintRule = {
    create: (context: RuleContext) => Visitor;
    meta?: RuleMeta;
};

/** An oxlint JS plugin: a namespace plus its rules. */
export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};
