import type { Family } from './families.js';

export type RowDocs = {
    /** `consumer` ships and is in the public catalogue; `self` is this package's own discipline, run only here. A rule that is both is two rules. */
    audience: 'consumer' | 'self';
    /** One per row: a convention enforced two ways is two rows, so a reader knows which pass a finding comes from. */
    channel: 'checker' | 'meta' | 'process' | 'runtime' | 'statique' | 'type' | 'upstream';
    convention: string;
    /** A ban with no destination is an argument, not a rule. */
    fix: string;
    /** Required: `model` is a statement (this reaches every facet), never a default. */
    facet: 'api' | 'cli' | 'component' | 'integration' | 'job' | 'mobile' | 'model' | 'website';
    family: Family;
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
    /** A `statique` or `checker` row's level: `warn` is the redundancy heuristic, every hard convention is `error`. */
    severity?: 'error' | 'warn';
};

export type Row = RowDocs & {
    /** Unique across the catalogue. */
    name: string;
};
