import sample from './expected/sample.json' with { type: 'json' };
import { rows } from './fixtures/rows.js';
import request from './requests/report.http?raw';
import seed from './seeds/rows.sql?raw';

export function report(): string {
    return `${sample.title}: ${rows.length} (${seed.length}, ${request.length})`;
}
