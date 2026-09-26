import { dirname } from 'node:path';

import {
    positionOf,
    shown,
    silenced,
    subjectSpecs,
    targetOf,
} from '../../engine/project/spec-subjects.js';
import type { SpecRead } from '../../engine/project/spec-subjects.js';
import { ambiguousSegment } from '../../engine/project/subject.js';
import type { Finding } from './checker.js';

/** No folder is derived from a word that may be a value: the author writes the template that says which it is. */
function ambiguityOf(specsRoot: string, spec: SpecRead, name: string): Finding | undefined {
    const at = spec.subjects.get(name);
    const segment = at === undefined ? undefined : ambiguousSegment(at.subject, spec.reading);
    if (at === undefined || segment === undefined || at.subject.facet !== 'api') {
        return undefined;
    }
    const { method, path } = at.subject;
    const verb = method.toLowerCase();
    const bare = path.split(/[?#]/u)[0] ?? '';
    const template = bare.replace(`/${segment}/`, '/:<name>/');
    const collection = bare.split('/').at(bare.split('/').indexOf(segment) - 1) ?? '';
    return {
        ...positionOf(spec.text, at.index),
        file: shown(specsRoot, spec.file),
        fix: `write the route's template: \`.${verb}('${template}', { params: { <name>: '${segment}' } })\` — or, if \`${segment}\` is the route's own segment, state that the path is the route: \`.${verb}('${bare}', { params: {} })\``,
        found: `\`${method} ${bare}\` names \`${segment}\` right after the collection \`${collection}\`: a value or a segment of the route, and the folder depends on which`,
        rule: 'spec-in-subject-folder' as const,
        severity: 'error' as const,
    };
}

export function checkSpecInSubjectFolder(specsRoot: string): Finding[] {
    return subjectSpecs(specsRoot).flatMap((spec) => {
        const [only] = [...spec.subjects.keys()];
        if (spec.subjects.size !== 1 || only === undefined || silenced(spec)) {
            return [];
        }
        const ambiguity = ambiguityOf(specsRoot, spec, only);
        if (ambiguity !== undefined) {
            return [ambiguity];
        }
        const target = targetOf(specsRoot, spec, only, true);
        if (dirname(target) === dirname(spec.file)) {
            return [];
        }
        return [
            {
                file: shown(specsRoot, spec.file),
                fix: `move it to ${shown(specsRoot, target)} — \`make fix\` moves it, and the ground it stands on`,
                found: `a spec of ${only}, filed under ${shown(specsRoot, dirname(spec.file))}/`,
                line: 1,
                rule: 'spec-in-subject-folder' as const,
                severity: 'error' as const,
            },
        ];
    });
}
