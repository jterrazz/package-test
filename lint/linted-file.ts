import { specsAnchor } from './ast.js';
import type { SpecsAnchor } from './ast.js';
import type { RuleContext } from './oxlint-api.js';
import { isProductionModule } from './production.js';
import { projectSegments, roleOf } from './role.js';
import type { FileIdentity } from './role.js';

/**
 * What every rule asks about the file oxlint hands it — its identity, whether
 * it is production, its `specs/` anchor, its segments below the project —
 * answered ONCE per file and shared by every rule that asks.
 *
 * Each answer walks up the tree probing the disk, and some sixty rules ask the
 * same question about the same file: answered per rule, the questions were
 * most of the plugin's time.
 *
 * The answers are keyed on `context.sourceCode`, which oxlint hands every rule
 * as the same object: its `WeakMap` forgets an entry keyed on it when a file's
 * lint ends, so no answer outlives the lint it was read for — in the editor's
 * host, which keeps this module loaded, as in a CLI run. The filename is kept
 * beside the answers and checked, so a map created before oxlint patched
 * `WeakMap` (a module a test imports first) answers for one file only too.
 */

/** The part of a rule's context the answers are read from. */
export type LintedFile = Pick<RuleContext, 'physicalFilename' | 'sourceCode'>;

/** One file's answers, each filled the first time a rule asks. */
type Answers = {
    anchor?: SpecsAnchor | undefined;
    anchorRead: boolean;
    filename: string;
    identity?: FileIdentity;
    production?: boolean;
    segments?: string[];
};

const answers = new WeakMap<object, Answers>();

/** The answers kept for the file being linted, fresh when it is another. */
function answersFor(file: LintedFile): Answers {
    const filename = file.physicalFilename;
    const known = answers.get(file.sourceCode);
    if (known?.filename === filename) {
        return known;
    }
    const fresh: Answers = { anchorRead: false, filename };
    answers.set(file.sourceCode, fresh);
    return fresh;
}

/** {@link roleOf} of the file being linted. */
export function identityOf(file: LintedFile): FileIdentity {
    const kept = answersFor(file);
    kept.identity ??= roleOf(kept.filename);
    return kept.identity;
}

/** {@link isProductionModule} of the file being linted. */
export function isProductionFile(file: LintedFile): boolean {
    const kept = answersFor(file);
    kept.production ??= isProductionModule(kept.filename);
    return kept.production;
}

/** {@link specsAnchor} of the file being linted. */
export function specsAnchorOf(file: LintedFile): SpecsAnchor | undefined {
    const kept = answersFor(file);
    if (!kept.anchorRead) {
        kept.anchor = specsAnchor(kept.filename);
        kept.anchorRead = true;
    }
    return kept.anchor;
}

/** {@link projectSegments} of the file being linted. */
export function segmentsOf(file: LintedFile): readonly string[] {
    const kept = answersFor(file);
    kept.segments ??= projectSegments(kept.filename);
    return kept.segments;
}
