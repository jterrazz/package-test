import type { Finding } from '../../engine/checker/finding.js';
import { byPosition, finding, productionReferences } from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';
import { LIBRARY_OWNERS } from './libraries.js';

export function checkOneOwnerPerLibrary(root: string): Finding<SelfPassId>[] {
    return productionReferences(root)
        .flatMap(({ from, reference }) => {
            const { specifier } = reference;
            const library = Object.keys(LIBRARY_OWNERS)
                .filter((name) => specifier === name || specifier.startsWith(`${name}/`))
                .toSorted((one, other) => other.length - one.length)[0];
            const owners = library === undefined ? [] : (LIBRARY_OWNERS[library] ?? []);
            return library === undefined || owners.some((owner) => from.startsWith(owner))
                ? []
                : [
                      finding(
                          'one-owner-per-library',
                          from,
                          {
                              fix: `reach the library through the port \`${owners.join('` or `')}\` implements, handed in by the facet — or import only what the owner exports`,
                              found: `\`${specifier}\` is imported outside \`${owners.join('` and `')}\`, the one slice that owns it`,
                          },
                          reference,
                      ),
                  ];
        })
        .toSorted(byPosition);
}
