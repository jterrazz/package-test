import { anthropic, defineStub } from '@jterrazz/test';

export default defineStub({
    request: anthropic.messages(),
    response: anthropic.stream(['Hel', 'lo, ', 'world']),
});
