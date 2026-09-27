import { resolve } from 'node:path';

import type { Finding } from '../../engine/checker/finding.js';
import { byPosition, finding, listed } from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';

const SYNONYM = /\.driver(?<test>\.test)?\.tsx?$/u;

export function checkOneWordForAnAdapter(root: string): Finding<SelfPassId>[] {
    return listed(resolve(root, 'src'), 'src')
        .filter(({ directory, path }) => !directory && SYNONYM.test(path))
        .map(({ path }) => {
            const name = path.split('/').at(-1) ?? '';
            return finding('one-word-for-an-adapter', path, {
                fix: `rename it \`<what it adapts>.adapter${SYNONYM.exec(name)?.groups?.test ?? ''}.ts\` — the process clock's is \`process-clock.adapter.ts\` — and the paths that import it`,
                found: `\`${name}\` carries the suffix \`.driver\`, a second word for an adapter`,
            });
        })
        .toSorted(byPosition);
}
