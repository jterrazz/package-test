import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import type { TokenViolation } from './checker.js';

/** The same pair the statique `no-simulated-dom-in-config` refuses. */
const SIMULATED_DOM = /\benvironment\s*:\s*['"](?<dom>happy-dom|jsdom)['"]/u;

export function simulatedDom(config: string, rootDir: string): TokenViolation[] {
    const text = readFileSync(config, 'utf8');
    const found = SIMULATED_DOM.exec(text);
    if (found?.groups?.dom === undefined) {
        return [];
    }
    const relConfig = relative(rootDir, config);
    return [
        {
            file: relConfig,
            line: text.slice(0, found.index).split('\n').length,
            fix: `delete \`environment: '${found.groups.dom}'\`, and write each rendered test as a \`.test.tsx\` beside its component, collected by \`component()\``,
            found: `\`environment: '${found.groups.dom}'\` gives every file of this project a drawing of a browser`,
            rule: 'no-simulated-dom-in-config',
            severity: 'error',
        },
    ];
}
