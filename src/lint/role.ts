import { isUnderSpecs, segments } from './ast.js';

/**
 * What KIND of file a rule is looking at, decided from its path alone.
 *
 * Every rule of the catalogue reaches a set of files, and until now each one
 * spelled that set out for itself — a suffix test here, a `specs/` walk there.
 * One answer, read from one place, is what lets a rule say "this is mine" in a
 * line and what makes a new kind (a rendered component) reachable by the rules
 * that should see it and invisible to the ones that should not.
 *
 * 15.2 answers what the component seam needs and no more. The full vocabulary —
 * `spec` (a test importing a `*.specification`), `contract`, `member`, and the
 * `.spec.ts` suffix that tells a spec from a module test — lands with the rule
 * wave in 16.0, where the checker's mover renames the trees it reads.
 */

/** The kinds this release tells apart. */
export type FileRole = 'component' | 'config' | 'ground' | 'module' | 'other' | 'specification';

/** What a rule reads about the file it was handed. */
export type FileIdentity = {
    /** Is an ancestor directory named `specs`? */
    inSpecs: boolean;
    /** The kind the path states. */
    role: FileRole;
};

/** The four ground names — what the specs of a row stand ON, never a spec. */
const GROUND = new Set(['_expected', '_fixtures', '_requests', '_seeds']);

/** A vitest config, whatever extension the project writes it in. */
const CONFIG = /^vitest\.config\.[cm]?[jt]s$/u;

/**
 * The kind of file this path names.
 *
 * The suffix decides, and the order matters: a `*.specification.ts` is a
 * specification wherever it sits, ground swallows anything under it that is not
 * a test of its own module, and `.tsx` versus `.ts` is what tells a RENDERED
 * unit from a plain one — the same distinction the two project helpers collect
 * on, so a file is judged by the rules of the project that actually runs it.
 */
export function roleOf(filename: string): FileIdentity {
    const parts = segments(filename);
    const base = parts.at(-1) ?? '';
    const inSpecs = isUnderSpecs(filename);

    if (base.endsWith('.specification.ts') || base.endsWith('.specification.tsx')) {
        return { inSpecs, role: 'specification' };
    }
    if (CONFIG.test(base)) {
        return { inSpecs, role: 'config' };
    }
    if (base.endsWith('.test.tsx')) {
        return { inSpecs, role: 'component' };
    }
    if (base.endsWith('.test.ts')) {
        return { inSpecs, role: 'module' };
    }
    if (parts.slice(0, -1).some((segment) => GROUND.has(segment))) {
        return { inSpecs, role: 'ground' };
    }
    return { inSpecs, role: 'other' };
}

/** Is this a file the test conventions reach — a test, or anything under `specs/`? */
export function isTestFile(filename: string): boolean {
    const { inSpecs, role } = roleOf(filename);
    return role === 'component' || role === 'module' || role === 'specification' || inSpecs;
}
