import { dirname } from 'node:path';

import {
    positionOf,
    shown,
    silenced,
    subjectSpecs,
    targetOf,
} from '../../kit/project/spec-subjects.js';
import type { SpecRead } from '../../kit/project/spec-subjects.js';
import { ambiguousSegment } from '../../kit/project/subject.js';
import type { Subject } from '../../kit/project/subject.js';
import type { Spotted } from './checker.js';

// invariant: no folder is derived from a word that may be a value: the author writes the template that says which it is.
function ambiguityOf(
    specsRoot: string,
    spec: SpecRead,
    at: { index: number; subject: Subject },
): Spotted | undefined {
    const segment = ambiguousSegment(at.subject, spec.reading);
    // Stryker disable next-line ConditionalExpression: ambiguousSegment names a segment of an api route alone; the specification check narrows the subject
    if (segment === undefined || at.subject.specification !== 'api') {
        return undefined;
    }
    const { method, path } = at.subject;
    const verb = method.toLowerCase();
    const bare = path.split(/[?#]/u)[0] ?? '';
    const template = bare.replace(`/${segment}/`, '/:<name>/');
    const collection = bare.split('/').at(bare.split('/').indexOf(segment) - 1) ?? '';
    return {
        ...positionOf(spec.text, at.index),
        path: shown(specsRoot, spec.file),
        fix: `write the route's template: \`.${verb}('${template}', { params: { <name>: '${segment}' } })\` or, if \`${segment}\` is the route's own segment, state that the path is the route: \`.${verb}('${bare}', { params: {} })\``,
        found: `\`${method} ${bare}\` names \`${segment}\` right after the collection \`${collection}\`: a value or a segment of the route, and the folder depends on which`,
        rule: 'spec-in-subject-folder' as const,
    };
}

export function checkSpecInSubjectFolder(specsRoot: string): Spotted[] {
    return subjectSpecs(specsRoot).flatMap((spec) => {
        if (spec.subjects.size !== 1 || silenced(spec, 'spec-in-subject-folder')) {
            return [];
        }
        const [entry] = [...spec.subjects];
        // Stryker disable next-line ConditionalExpression,BlockStatement,ArrayDeclaration: a spec of one subject has its entry
        if (entry === undefined) {
            return [];
        }
        const [only, at] = entry;
        const ambiguity = ambiguityOf(specsRoot, spec, at);
        if (ambiguity !== undefined) {
            return [ambiguity];
        }
        const target = targetOf(specsRoot, spec, only);
        if (target === undefined || dirname(target) === dirname(spec.file)) {
            return [];
        }
        return [
            {
                path: shown(specsRoot, spec.file),
                fix: `move it to ${shown(specsRoot, target)}; \`typescript fix\` moves it, and the ground it stands on`,
                found: `a spec of ${only}, filed under ${shown(specsRoot, dirname(spec.file))}/`,
                line: 1,
                rule: 'spec-in-subject-folder' as const,
            },
        ];
    });
}
