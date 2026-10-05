import { resolve } from 'node:path';
import type { UserConfigFn } from 'vite';
import type { TestProjectInlineConfiguration } from 'vitest/config';

export function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

export function pluginNames(project: TestProjectInlineConfiguration): string[] {
    const plugins: unknown[] = Array.isArray(project.plugins) ? project.plugins : [];
    return plugins.flatMap((plugin) =>
        typeof plugin === 'object' && plugin !== null && 'name' in plugin
            ? [String(plugin.name)]
            : [],
    );
}

export const returnsNothing = async (): Promise<void> => undefined;

export function untyped(source: unknown): UserConfigFn {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an untyped caller's source yields what the type forbids
    return source as UserConfigFn;
}

/** The setup file a project wraps its renders through, written under the folder it resolves against. */
export function setupFileIn(folder: string): string[] {
    return [resolve(folder, '.artifacts/vitest/component-setup.mjs')];
}
