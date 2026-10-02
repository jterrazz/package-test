/** English, like every sentence the catalogue publishes: a meta-test holds the line with a deny-list. */
export const FAMILIES = {
    setup: 'Constructors, configuration, projects and infrastructure',
    chain: 'The chain and its markers',
    layout: 'Files, folders, sizes, names, and the suppressions a file carries',
    expectations: 'What is compared, and how',
    stubs: 'What the outside world replies, and where the stubs are filed',
    services: 'The services a run starts, and the seeds laid in them',
    clock: 'Time: the pinned instant, sleeps and sampled values',
    mocks: 'Doubles of a port',
    visitor: 'Screens, targets and scenarios',
    imports: 'Who imports whom, and protecting production',
    architecture: 'Source layers',
} as const;

export type Family = keyof typeof FAMILIES;
