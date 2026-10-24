import { defineStandard } from '@jterrazz/typescript/config';

export default defineStandard({
    test: {
        specifications: [
            'api',
            'cli',
            'component',
            'deployment',
            'integration',
            'job',
            'lint',
            'mobile',
            'website',
        ],
        projects: {
            lint: {
                isolate: false,
                reason: 'a lint spec lays its own fixture tree and runs the linters as processes of their own, so a worker runs its files in one module graph',
            },
            unit: {
                isolate: false,
                reason: 'a module test leaves no state behind in a module, so a worker runs its files in one module graph',
            },
        },
    },
});
