import type { Context } from '@oxlint/plugins';

import { specsAnchor } from './ast.js';
import type { SpecsAnchor } from './ast.js';
import { isProductionModule } from './material.js';
import { projectSegments, roleOf } from './role.js';
import type { FileIdentity } from './role.js';

/** Keyed on `context.sourceCode`, the one object oxlint hands every rule for a file, so a `WeakMap` drops the answers when its lint ends; the filename is checked too, for a map created before oxlint patched `WeakMap`. */

export type LintedFile = Pick<Context, 'physicalFilename' | 'sourceCode'>;

type Answers = {
    anchor?: SpecsAnchor | undefined;
    anchorRead: boolean;
    filename: string;
    identity?: FileIdentity;
    production?: boolean;
    segments?: string[];
};

const answers = new WeakMap<object, Answers>();

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

export function identityOf(file: LintedFile): FileIdentity {
    const kept = answersFor(file);
    kept.identity ??= roleOf(kept.filename);
    return kept.identity;
}

export function isProductionFile(file: LintedFile): boolean {
    const kept = answersFor(file);
    kept.production ??= isProductionModule(kept.filename);
    return kept.production;
}

export function specsAnchorOf(file: LintedFile): SpecsAnchor | undefined {
    const kept = answersFor(file);
    if (!kept.anchorRead) {
        kept.anchor = specsAnchor(kept.filename);
        kept.anchorRead = true;
    }
    return kept.anchor;
}

export function segmentsOf(file: LintedFile): readonly string[] {
    const kept = answersFor(file);
    kept.segments ??= projectSegments(kept.filename);
    return kept.segments;
}
