import { appendFileSync } from 'node:fs';
import { afterAll } from 'vitest';

import { graph } from './graph.mjs';

graph.otherLoads = (graph.otherLoads ?? 0) + 1;

export const other = { boot: graph.otherLoads };

afterAll(() => {
    appendFileSync('cleanups', `other ${other.boot}\n`);
});
