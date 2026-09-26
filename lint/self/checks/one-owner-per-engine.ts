import type { Finding } from '../../checks/checker.js';
import type { SelfPassId } from './checker.js';
import { ENGINE_OWNERS } from './engines.js';
import { byPosition, finding, productionReferences } from './source.js';

export function checkOneOwnerPerEngine(root: string): Finding<SelfPassId>[] {
    return productionReferences(root)
        .flatMap(({ from, reference }) => {
            const { specifier } = reference;
            const engine = Object.keys(ENGINE_OWNERS)
                .filter((name) => specifier === name || specifier.startsWith(`${name}/`))
                .toSorted((one, other) => other.length - one.length)[0];
            const owners = engine === undefined ? [] : (ENGINE_OWNERS[engine] ?? []);
            return engine === undefined || owners.some((owner) => from.startsWith(owner))
                ? []
                : [
                      finding(
                          'one-owner-per-engine',
                          from,
                          {
                              fix: `reach the engine through the port \`${owners.join('` or `')}\` implements, handed in by the facet — or import only what the owner exports`,
                              found: `\`${specifier}\` is imported outside \`${owners.join('` and `')}\`, the one slice that owns it`,
                          },
                          reference,
                      ),
                  ];
        })
        .toSorted(byPosition);
}
