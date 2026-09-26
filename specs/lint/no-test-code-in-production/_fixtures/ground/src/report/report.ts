import sample from './_expected/sample.json' with { type: 'json' };
import { rows } from './_fixtures/rows.js';
import request from './_requests/report.http?raw';
import seed from './_seeds/rows.sql?raw';

export function report(): string {
    return `${sample.title}: ${rows.length} (${seed.length}, ${request.length})`;
}
