import { defineStandard } from '@jterrazz/typescript/config';

export default defineStandard({
    test: {
        specifications: [
            'api',
            'cli',
            'component',
            'integration',
            'job',
            'lint',
            'mobile',
            'website',
        ],
        projects: {
            unit: {
                isolate: false,
                reason: 'a module test leaves no state behind in a module, so a worker runs its files in one module graph',
            },
        },
    },
});
