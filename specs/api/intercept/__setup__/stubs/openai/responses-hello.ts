import { defineStub, openai } from '@jterrazz/test/stubs';

export default defineStub({
    request: openai.responses(),
    response: openai.stream(['Hel', 'lo, ', 'world'], { api: 'responses' }),
});
