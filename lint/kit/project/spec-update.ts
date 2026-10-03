import { RUN_KEYS } from './spec-grammar.js';
import type { SpecFile, SpecRunUpdate } from './spec-grammar.js';
import { blockScalar, isMap, isScalar, isSeq, renderYamlSource } from './yaml-document.js';
import type { Pair, YAMLMap } from './yaml-document.js';

function keyOf(pair: Pair): string {
    return String(isScalar(pair.key) ? pair.key.value : pair.key);
}

function setOrdered(map: YAMLMap, key: string, value: unknown, order: readonly string[]): void {
    const later = new Set(order.slice(order.indexOf(key) + 1));
    const at = map.items.findIndex((pair) => later.has(keyOf(pair)));
    const isNew = !map.has(key);
    map.set(key, value);
    if (isNew && at !== -1) {
        map.items.splice(at, 0, ...map.items.splice(-1));
    }
}

/** The YAML document is edited, not re-emitted, so everything but exit codes and streams comes back byte-identical. */
export function updateSpecFile(file: SpecFile, updates: SpecRunUpdate[]): string {
    const root = file.source.document.contents;
    // Stryker disable next-line all: readSpecFile refused any document whose runs is not a list
    const runs = isMap(root) ? root.get('runs', true) : undefined;
    // Stryker disable next-line all: readSpecFile refused any document whose runs is not a list
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
