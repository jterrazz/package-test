import { relative } from 'node:path';

import { lineAt, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

/** The same pair the static `no-simulated-dom-in-config` refuses. */
const SIMULATED_DOM = /\benvironment\s*:\s*['"](?<dom>happy-dom|jsdom)['"]/u;

export function checkNoSimulatedDomInConfig(config: string, rootDir: string): Spotted[] {
    const text = readText(config);
    const found = SIMULATED_DOM.exec(text);
    if (found === null) {
        return [];
    }
    // Stryker disable next-line StringLiteral: a match always carries the environment it names
    const { dom = '' } = found.groups ?? {};
    return [
        {
            path: relative(rootDir, config),
            line: lineAt(text, found.index),
            fix: `delete \`environment: '${dom}'\`, and write each rendered test as a \`.test.tsx\` beside its component, collected by the \`component\` project`,
            found: `\`environment: '${dom}'\` gives every file of this project a drawing of a browser`,
            rule: 'no-simulated-dom-in-config',
        },
    ];
}
