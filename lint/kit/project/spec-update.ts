import { RUN_KEYS } from './spec-grammar.js';
import type { SpecFile, SpecRunUpdate } from './spec-grammar.js';
import { scalarString } from './spec-node.js';
import { blockScalar, isMap, isSeq, nodePairs, renderYamlSource } from './yaml-document.js';
import type { YAMLMap } from './yaml-document.js';

function setOrdered(map: YAMLMap, key: string, value: unknown, order: readonly string[]): void {
    const items = nodePairs(map);
    const existing = items.findIndex((pair) => scalarString(pair.key) === key);
    if (existing !== -1) {
        map.set(key, value);
        return;
    }
    const rank = order.indexOf(key);
    const at = items.findIndex((pair) => {
        const seen = scalarString(pair.key);
        return seen !== null && order.indexOf(seen) > rank;
    });
    map.set(key, value);
    if (at !== -1) {
        // invariant: `set` appended: move the new pair to its canonical place.
        const added = map.items.pop();
        if (added !== undefined) {
            map.items.splice(at, 0, added);
        }
    }
}

/** The YAML document is edited, not re-emitted, so everything but exit codes and streams comes back byte-identical. */
export function updateSpecFile(file: SpecFile, updates: SpecRunUpdate[]): string {
    const root = file.source.document.contents;
    const runs = isMap(root) ? root.get('runs', true) : undefined;
    if (!isSeq(runs)) {
        return renderYamlSource(file.source);
    }
    for (const [index, update] of updates.entries()) {
        const run = runs.items[index];
        if (!isMap(run)) {
            continue;
        }
        setOrdered(run, 'exit', update.exitCode, RUN_KEYS);
        for (const [key, text] of [
            ['stdout', update.stdout],
            ['stderr', update.stderr],
        ] as const) {
            if (text.length === 0) {
                run.delete(key);
                continue;
            }
            setOrdered(run, key, blockScalar(text), RUN_KEYS);
        }
    }
    return renderYamlSource(file.source);
}
