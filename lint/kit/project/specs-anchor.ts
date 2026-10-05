import { isProjectRoot } from '@jterrazz/typescript/rules';
import { basename, dirname } from 'node:path';

export function segments(path: string): string[] {
    return path.split(/[/\\]/u).filter(Boolean);
}

export type SpecsAnchor = {
    directory: string;
    /** `[specification, domain, basename]`. */
    relative: string[];
};

/** The NEAREST `specs` ancestor, never above the project root: a checkout living under `~/specs/` must not read as one whole specs tree. */
export function specsAnchor(filename: string): SpecsAnchor | undefined {
    const relative = [basename(filename)];
    let directory = dirname(filename);
    for (;;) {
        if (basename(directory) === 'specs') {
            return { directory, relative };
        }
        if (isProjectRoot(directory)) {
            return undefined;
        }
        const parent = dirname(directory);
        if (parent === directory) {
            return undefined;
        }
        relative.unshift(basename(directory));
        directory = parent;
    }
}

export function isUnderSpecs(filename: string): boolean {
    return specsAnchor(filename) !== undefined;
}
