import {
    secondSubjectAt,
    shown,
    silenced,
    splitPlan,
    subjectSpecs,
} from '../../kit/project/spec-subjects.js';
import type { SpecRead, TestOf } from '../../kit/project/spec-subjects.js';
import type { Spotted } from './checker.js';

function journeyOf(spec: SpecRead): TestOf | undefined {
    return spec.tests.find((test) => test.subjects.length > 1);
}

function splitAdvice(specsRoot: string, spec: SpecRead): string {
    const journey = journeyOf(spec);
    const targets = [...splitPlan(specsRoot, spec).values()].map((path) => shown(specsRoot, path));
    const advice: string[] = [];
    if (targets.length >= 2) {
        advice.push(
            `split it, one file per subject — ${targets.join(', ')} — \`typescript fix\` splits it`,
        );
    }
    if (journey !== undefined) {
        advice.push(
            `the test "${journey.title}" reaches ${journey.subjects.join(' and ')} — state what it stands on with a seed, and keep one subject per test`,
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
                found: `a spec reaching ${names.length} subjects — ${names.join(', ')}`,
                rule: 'one-subject-per-spec' as const,
            },
        ];
    });
}
