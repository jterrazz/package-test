import { graph } from './graph.mjs';

graph.loads += 1;

export const subject = { boot: graph.loads };
