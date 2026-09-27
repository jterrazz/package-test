import { GROUND_DIRS } from '../../engine/project/ground.js';
import { SPEC_EXTENSION } from '../../engine/project/spec-document.js';
import type { Finding } from './checker.js';

const GROUND_NAMES = new Set<string>(GROUND_DIRS);

export function noDocumentInGroundFindings(file: string, name: string): Finding[] {
    return file.split(/[/\\]/u).some((segment) => GROUND_NAMES.has(segment))
        ? [
              {
                  file,
                  line: 1,
                  fix: `move ${name} out of the ground folder, beside the test that runs it`,
                  found: `a \`${SPEC_EXTENSION}\` document under a ground folder`,
                  rule: 'no-document-in-ground',
              },
          ]
        : [];
}
