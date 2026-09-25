import { defineStub, openai } from '../../../../../src/index.js';

export default defineStub({
    request: openai.responses(),
    response: openai.stream(['Hel', 'lo, ', 'world'], { api: 'responses' }),
});
