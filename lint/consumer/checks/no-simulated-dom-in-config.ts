import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import type { Spotted } from './checker.js';

/** The same pair the static `no-simulated-dom-in-config` refuses. */
const SIMULATED_DOM = /\benvironment\s*:\s*['"](?<dom>happy-dom|jsdom)['"]/u;

export function checkNoSimulatedDomInConfig(config: string, rootDir: string): Spotted[] {
    const text = readFileSync(config, 'utf8');
    const found = SIMULATED_DOM.exec(text);
    if (found?.groups?.dom === undefined) {
        return [];
    }
    const relConfig = relative(rootDir, config);
    return [
        {
            path: relConfig,
            line: text.slice(0, found.index).split('\n').length,
            fix: `delete \`environment: '${found.groups.dom}'\`, and write each rendered test as a \`.test.tsx\` beside its component, collected by the \`component\` project`,
            found: `\`environment: '${found.groups.dom}'\` gives every file of this project a drawing of a browser`,
            rule: 'no-simulated-dom-in-config',
        },
    ];
}
