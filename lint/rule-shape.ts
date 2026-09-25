import type { AfterHook, BeforeHook, Context, Node, RuleDocs, RuleMeta } from '@oxlint/plugins';

/**
 * The shapes this layer writes its rules in, over oxlint's own plugin types.
 *
 * oxlint's API — the context a rule is handed, what it reports, the fixer, the
 * comments — belongs to `@oxlint/plugins` and is imported from it. Two things
 * are this layer's own: the view a rule takes of a node, read by its `type`
 * and its span and every other field defensively, so a rule is decoupled from
 * the generated ESTree union and its churn; and the documentation a rule
 * carries, the {@link RuleDoc} the catalogue is generated from.
 *
 * The published declarations import these types, so `@oxlint/plugins` is a
 * dependency, not a dev one.
 */

/** A node as a rule reads it: oxlint's span and its `type`, every other field unknown until read. */
export type AstNode = Node & { type: string; [key: string]: unknown };

/** A rule's handlers, by node type, and the hooks that open and close each file. */
export type Visitor = Record<string, (node: AstNode) => void> & {
    after?: AfterHook;
    before?: BeforeHook;
};

/**
 * The normative documentation a rule carries — the code is the source of truth
 * for the mechanized catalogue (docs-as-code inversion). Every plugin rule sets
 * `meta.docs` to its {@link RuleDoc} entry from `manifest.ts`; the catalogue
 * generator reads these to (re)write `docs/19-linting.md` and the annex.
 */
export type RuleDoc = {
    /**
     * Who the rule is for — ONE per row, and never a default.
     *
     * - `consumer` — meaningful in any project that uses the package: it is
     *   wired into what the package publishes (the plugin, the checker, the
     *   runtime, the types) and its row is in the public catalogue
     *   (`docs/19-linting.md`);
     * - `self` — this package's own suite discipline: its catalogue, its
     *   capability matrix, its specimens, its skill, its meta-tests. It is
     *   wired only in this repository's own lint configuration and
     *   meta-tests, nothing the tarball carries runs it, and its row is read
     *   where the package says how it tests itself (`docs/03-testing.md` of
     *   its repository, a chapter the tarball leaves out).
     *
     * A rule that is both is two rules: its consumer half ships, its self
     * half stays home.
     */
    audience: 'consumer' | 'self';
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
     * Which tree of the source the rule belongs to, and therefore where its
     * implementation sits: `lint/rules/model/` for a rule that reaches every
     * facet, `lint/rules/<facet>/` for one that guards a single
     * constructor's vocabulary. The catalogue is grouped on it — model first,
     * then one section per facet — so a reader adopting one facet sees the
     * rules that reach them and nothing else.
     *
     * Required, like `fix` and `reach`: a rule with no tree is a rule nobody
     * placed, and `model` is a statement (this reaches every facet), not a
     * default to fall into. The checker's passes carry the field too, although
     * their implementations do not split by folder — several passes share one
     * module because they share one walk of the tree, so the field alone says
     * which facet a pass speaks for.
     */
    facet: 'api' | 'cli' | 'component' | 'integration' | 'jobs' | 'mobile' | 'model' | 'website';
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
        | 'document'
        | 'ground'
        | 'member'
        | 'module'
        | 'spec'
        | 'specification'
        | 'specs'
        | 'stub'
        | 'tests';
};

/**
 * A rule as this layer writes it: its visitor over {@link AstNode}, and its
 * catalogue entry.
 *
 * `createOnce` builds the visitor once per run; `before` opens each file,
 * resets what the rule keeps for one file, and returns `false` for a file the
 * rule does not judge, which skips it. The context answers only inside the
 * hooks and the handlers: it is a file's context, and none is open while the
 * visitor is built.
 */
export type LintRule = {
    createOnce: (context: Context) => Visitor;
    meta: RuleMeta & { docs: RuleDoc & RuleDocs };
};

/** The plugin: its namespace, and its rules as this layer writes them. */
export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};
