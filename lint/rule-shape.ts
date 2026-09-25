import type { AfterHook, BeforeHook, Context, Node, RuleDocs, RuleMeta } from '@oxlint/plugins';

/** A rule reads a node by its `type` and span and every other field defensively, decoupled from the generated ESTree union. The published declarations import `@oxlint/plugins`, so it is a dependency. */

export type AstNode = Node & { type: string; [key: string]: unknown };

export type Visitor = Record<string, (node: AstNode) => void> & {
    after?: AfterHook;
    before?: BeforeHook;
};

export type RuleDoc = {
    /** `consumer` ships and is in the public catalogue; `self` is this package's own discipline, run only here. A rule that is both is two rules. */
    audience: 'consumer' | 'self';
    /** One per row: a convention enforced two ways is two rows, so a reader knows which pass a finding comes from. */
    channel: 'checker' | 'meta' | 'process' | 'runtime' | 'statique' | 'type' | 'upstream';
    convention: string;
    /** A ban with no destination is an argument, not a rule. */
    fix: string;
    /** Required: `model` is a statement (this reaches every facet), never a default. */
    facet: 'api' | 'cli' | 'component' | 'integration' | 'job' | 'mobile' | 'model' | 'website';
    family: string;
    id: string;
    rationale: string;
    /** An `upstream` row names the rule whose option carries it; the completeness meta-test reads it. */
    upstream?: string;
    /** `module` is the colocated unit test; a module-role file under `specs/` is a repository suite. */
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

/** `before` opens each file and returns `false` to skip it; the context answers only inside the hooks and handlers. */
export type LintRule = {
    createOnce: (context: Context) => Visitor;
    meta: RuleMeta & { docs: RuleDoc & RuleDocs };
};

export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};
