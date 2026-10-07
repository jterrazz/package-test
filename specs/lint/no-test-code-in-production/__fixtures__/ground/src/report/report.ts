import sample from './__expected__/sample.json' with { type: 'json' };
import { rows } from './__fixtures__/rows.js';
import request from './__requests__/report.http?raw';
import seed from './__seeds__/rows.sql?raw';

export function report(): string {
    return `${sample.title}: ${rows.length} (${seed.length}, ${request.length})`;
}
