import { dirname } from 'node:path';

import {
    secondSubjectAt,
    shown,
    silenced,
    splitPlan,
    subjectSpecs,
} from '../../kit/project/spec-subjects.js';
import type { SpecRead, TestOf } from '../../kit/project/spec-subjects.js';
import type { Spotted } from './checker.js';
import { splitRefusal } from './spec-in-subject-folder.refusal.js';

function journeyOf(spec: SpecRead): TestOf | undefined {
    return spec.tests.find((test) => test.subjects.length > 1);
}

// invariant: the plan names the tests each subject takes and the folder it files under, never the file: naming a file is its author's, and \`typescript fix\` writes no split.
function planLines(specsRoot: string, spec: SpecRead, plan: ReadonlyMap<string, string>): string[] {
    return [...plan].map(([name, target]) => {
        const titles = spec.tests
            .filter((test) => test.subjects[0] === name)
            .map(({ title }) => `"${title}"`);

        return `${name} → ${shown(specsRoot, dirname(target))}/ (${titles.join(', ')})`;
    });
}

function splitAdvice(specsRoot: string, spec: SpecRead): string {
    const journey = journeyOf(spec);
    const plan = splitPlan(specsRoot, spec);
    const refusal = splitRefusal(specsRoot, spec, plan);
    const advice: string[] = [];
    if (plan.size >= 2 || refusal !== undefined) {
        const parts = [
            'split it by hand, one file per subject, each file named by you',
            ...(plan.size >= 2 ? [planLines(specsRoot, spec, plan).join('; ')] : []),
            ...(refusal === undefined ? [] : [`beware: ${refusal}`]),
        ];
        advice.push(parts.join('; '));
    }
    if (journey !== undefined) {
        advice.push(
            `the test "${journey.title}" reaches ${journey.subjects.join(' and ')}: state what it stands on with a seed, and keep one subject per test`,
        );
    }
    return advice.join('; ');
}

export function checkOneSubjectPerSpec(specsRoot: string): Spotted[] {
    return subjectSpecs(specsRoot).flatMap((spec) => {
        if (spec.subjects.size < 2 || silenced(spec, 'one-subject-per-spec')) {
            return [];
        }
        const names = [...spec.subjects.keys()];
        return [
            {
                ...secondSubjectAt(spec),
                path: shown(specsRoot, spec.file),
                fix: splitAdvice(specsRoot, spec),
                found: `a spec reaching ${names.length} subjects: ${names.join(', ')}`,
                rule: 'one-subject-per-spec' as const,
            },
        ];
    });
}
