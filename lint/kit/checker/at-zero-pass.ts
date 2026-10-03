import type { Pass } from '@jterrazz/typescript/rules';
import { relative } from 'node:path';

import { discoverSpecRoots } from '../project/members.js';
import type { SelfRegistry } from './registry.js';
import { CHECKER_NAMESPACE, teacherOf, underTree } from './teacher.js';

export function atZeroPass(registry: SelfRegistry): Pass {
    const teach = teacherOf(registry);

    return {
        check({ root }) {
            const findings = teach([
                ...registry.source.flatMap((pass) => pass(root)),
                ...discoverSpecRoots(root).flatMap((specsRoot) =>
                    underTree(
                        registry.specs.flatMap((pass) => pass(specsRoot)),
                        relative(root, specsRoot),
                    ),
                ),
            ]);

            return {
                findings,
                lines:
                    findings.length === 0
                        ? [`self checker: no error under ${root} (${registry.passIds.join(', ')})`]
                        : [],
            };
        },
        namespace: CHECKER_NAMESPACE,
    };
}
