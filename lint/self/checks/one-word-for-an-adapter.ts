import { resolve } from 'node:path';

import type { Finding } from '../../engine/checker/finding.js';
import { byPosition, finding, listed } from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';

const SYNONYM = /\.driver(?<tail>(?:\.[a-z-]+)*)\.(?<extension>tsx?)$/u;

export function checkOneWordForAnAdapter(root: string): Finding<SelfPassId>[] {
    return listed(resolve(root, 'src'), 'src')
        .filter(({ directory, path }) => !directory && SYNONYM.test(path))
        .map(({ path }) => {
            const name = path.split('/').at(-1) ?? '';
            const { extension = 'ts', tail = '' } = SYNONYM.exec(name)?.groups ?? {};
            return finding('one-word-for-an-adapter', path, {
                fix: `rename it \`<what it adapts>.adapter${tail}.${extension}\` — the process clock's is \`process-clock.adapter.ts\` — and the paths that import it`,
                found: `\`${name}\` carries the suffix \`.driver\`, a second word for an adapter`,
            });
        })
        .toSorted(byPosition);
}
