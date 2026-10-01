import { cpSync, existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { refusal } from '../../lint/refusal.js';
import { resolveSpecPath } from '../chain/paths/resolved-spec-path.js';
import type { FixturePort } from './fixture.port.js';

type FixtureCopyPlan = {
    dest: string;
    src: string;
};

/** `./dir/` spreads a directory's contents, `./file` copies one file; a path naming the other kind, or nothing, is refused. */
export function copyPlan(path: string, specDir: string, workDir: string): FixtureCopyPlan {
    const src = resolveSpecPath('fixture', path, specDir);
    if (!existsSync(src)) {
        throw new Error(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `create ${src}, or correct the path`,
                found: `fixture: ${JSON.stringify(path)} names nothing — ${src} does not exist`,
            }),
        );
    }
    const spread = path.endsWith('/');
    const isDirectory = statSync(src).isDirectory();
    if (isDirectory !== spread) {
        throw new TypeError(
            refusal(
                'disk-named-by-relative-path-at-runtime',
                isDirectory
                    ? {
                          fix: `end its path in /: directory('${path}/') — its contents are spread into the working directory`,
                          found: `fixture: ${JSON.stringify(path)} names a directory`,
                      }
                    : {
                          fix: `drop the /: file('${path.replace(/\/+$/u, '')}')`,
                          found: `fixture: ${JSON.stringify(path)} names a file`,
                      },
            ),
        );
    }
    const dest = spread ? workDir : resolve(workDir, basename(src));
    return { dest, src };
}

export const fsFixtures: FixturePort = {
    layer: (path, testDir, workDir) => {
        const { dest, src } = copyPlan(path, testDir, workDir);
        cpSync(src, dest, { recursive: true });
    },
};
