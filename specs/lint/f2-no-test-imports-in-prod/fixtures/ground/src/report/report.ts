import sample from './expected/sample.json' with { type: 'json' };
import { rows } from './fixtures/rows.js';

export function report(): string {
    return `${sample.title}: ${rows.length}`;
}
