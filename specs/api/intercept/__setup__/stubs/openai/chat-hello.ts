import { defineStub, openai } from '@jterrazz/test';

export default defineStub({
    request: openai.chat(),
    response: openai.stream(['Hel', 'lo, ', 'world']),
});
