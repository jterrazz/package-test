import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const run = spawnSync('vitest', ['run', '--reporter=json', '--outputFile=report.json'], { encoding: 'utf8' });
const { testResults } = JSON.parse(readFileSync('report.json', 'utf8'));
const lines = testResults.flatMap(({ assertionResults, name }) =>
    assertionResults.map(({ fullName, status }) => `${relative(process.cwd(), name)} > ${fullName}: ${status}`),
);
process.stdout.write(`${lines.toSorted().join('\n')}\n`);
process.exitCode = run.status ?? 1;
