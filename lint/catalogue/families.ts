/** English, like every sentence the catalogue publishes: a meta-test holds the line with a deny-list. */
export const FAMILIES = {
    setup: 'Constructors, configuration, projects and infrastructure',
    chain: 'The chain and its markers',
    layout: 'Files, folders, sizes and names',
    expectations: 'What is compared, and how',
    world: 'Stubs, doubles, time and seeds',
    elements: 'Screens, descriptors and scenarios',
    imports: 'Who imports whom, and protecting production',
    architecture: 'Source layers',
    catalogue: 'The catalogue holding itself',
} as const;

export type Family = keyof typeof FAMILIES;
