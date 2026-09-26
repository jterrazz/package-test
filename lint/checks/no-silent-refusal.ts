import type { SpecDocument } from '../../src/facets/cli/documents/spec-document.js';
import { finding } from './document-model.js';
import type { Finding } from './document-model.js';

export function checkSilentRefusals(document: SpecDocument): Finding[] {
    return document.runs
        .filter((run) => run.exitCode !== 0 && run.stdout === null && run.stderr === null)
        .map((run) =>
            finding(
                'no-silent-refusal',
                run.commandLine,
                {
                    fix: 'write the words the refusal printed under `stderr:` (or `stdout:`)',
                    found: `\`exit: ${run.exitCode}\` with no \`stdout:\` and no \`stderr:\``,
                },
                'warn',
            ),
        );
}
