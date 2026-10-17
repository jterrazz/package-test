import { defineStub, openai } from '@jterrazz/test/stubs';

export default defineStub({
    request: openai.chat(),
    response: openai.stream(['Hel', 'lo, ', 'world']),
});
