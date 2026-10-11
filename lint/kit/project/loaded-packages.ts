import { derivedProjects } from './derived-projects.js';

// outside: this package loads by name the peers each project drives (a browser, a simulator), so the project that declares them imports none.
const LOADED_BY = {
    component: ['@vitest/browser-playwright', 'playwright', 'vitest-browser-react'],
    mobile: ['appium', 'webdriverio'],
    website: ['@vitest/browser-playwright', 'playwright'],
};

/** The peers the projects a tree names drive through this package, which the project declares and imports nowhere. */
export function packagesLoadedFor(root: string): string[] {
    const projects = derivedProjects(root);

    return Object.entries(LOADED_BY).flatMap(([project, names]) =>
        projects.has(project) ? names : [],
    );
}
