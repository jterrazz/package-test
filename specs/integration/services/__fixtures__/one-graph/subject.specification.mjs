import { appendFileSync } from 'node:fs';
import { afterAll } from 'vitest';

import { graph } from './graph.mjs';

graph.loads += 1;

export const subject = { boot: graph.loads };

afterAll(() => {
    appendFileSync('cleanups', `boot ${subject.boot}\n`);
});
