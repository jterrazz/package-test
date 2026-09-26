import { DOCUMENT_KEYS, RUN_KEYS } from '../../src/facets/cli/documents/spec-document.js';
import type { SpecFile } from '../../src/facets/cli/documents/spec-document.js';
import type { Node, Pair, YAMLMap } from '../../src/kernel/yaml/document.js';
import { documentMap, finding, keyName, pairsOf, runMaps } from './document-model.js';
import type { Finding } from './document-model.js';

export function checkKeyOrder(
    file: SpecFile,
    lineAt: (node: Pair<Node, Node>) => number,
): Finding[] {
    const findings: Finding[] = [];
    const inspect = (map: YAMLMap, order: readonly string[], where: string): void => {
        let highest = -1;
        let highestKey = '';
        for (const pair of pairsOf(map)) {
            const key = keyName(pair);
            const rank = key === null ? -1 : order.indexOf(key);
            if (rank === -1) {
                continue;
            }
            if (rank < highest) {
                findings.push(
                    finding('document-keys-in-canonical-order', lineAt(pair), {
                        fix: `order the keys ${order.join(', ')} — \`make fix\` reorders them`,
                        found: `"${key}:" after "${highestKey}:" in ${where}`,
                    }),
                );
                return;
            }
            highest = rank;
            highestKey = key ?? '';
        }
    };
    const map = documentMap(file);
    if (map !== null) {
        inspect(map, DOCUMENT_KEYS, 'a spec document');
    }
    for (const run of runMaps(file)) {
        inspect(run, RUN_KEYS, 'a run');
    }
    return findings;
}
