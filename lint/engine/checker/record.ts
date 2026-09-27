import { countsOf, labelOf } from '@jterrazz/typescript/rules';
import type { EngineCommand } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';

import { writeBaseline } from '../baseline/test-baseline.js';
import { TEST_SECTION } from '../project/test-section.js';
import { directoryRefusal, projectSpotted } from './conventions.js';
import type { CheckerRegistry } from './registry.js';
import { teacherOf } from './teacher.js';

export function recordBaseline(registry: CheckerRegistry): EngineCommand {
    const teach = teacherOf(registry);

    return (args) => {
        const positional = args.find((argument) => !argument.startsWith('-')) ?? '.';
        const refused = directoryRefusal(positional, 'project root');
        if (refused !== null) {
            process.stdout.write(`${refused}\n`);

            return 1;
        }
        const root = resolve(positional);
        const findings = teach(projectSpotted(registry, root));
        const counts = countsOf(findings);
        writeBaseline(root, counts);
        process.stdout.write(
            `${labelOf(TEST_SECTION)} written — ${String(findings.length)} finding(s) across ${String(Object.keys(counts).length)} rule(s)\n`,
        );

        return 0;
    };
}
