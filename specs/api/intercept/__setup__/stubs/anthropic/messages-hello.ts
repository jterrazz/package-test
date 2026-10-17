import { anthropic, defineStub } from '@jterrazz/test/stubs';

export default defineStub({
    request: anthropic.messages(),
    response: anthropic.stream(['Hel', 'lo, ', 'world']),
});
