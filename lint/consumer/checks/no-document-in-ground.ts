import { GROUND_FOLDERS } from '@jterrazz/typescript/rules';

import { SPEC_EXTENSION } from '../../kit/project/spec-document.js';
import type { Spotted } from './checker.js';

const GROUND_NAMES = new Set<string>(GROUND_FOLDERS);

export function noDocumentInGroundFindings(file: string, name: string): Spotted[] {
    return file.split(/[/\\]/u).some((segment) => GROUND_NAMES.has(segment))
        ? [
              {
                  path: file,
                  line: 1,
                  fix: `move ${name} out of the ground folder, beside the test that runs it`,
                  found: `a \`${SPEC_EXTENSION}\` document under a ground folder`,
                  rule: 'no-document-in-ground',
              },
          ]
        : [];
}
