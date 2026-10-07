import { writeFileSync } from 'node:fs';

import { graph } from './graph.mjs';

export function record(name, subject) {
    writeFileSync(`${name}.run`, `boot ${subject.boot} of ${graph.loads} loads`);
}
