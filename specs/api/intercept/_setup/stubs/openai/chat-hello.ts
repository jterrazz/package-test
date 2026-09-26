import { defineStub, openai } from '../../../../../../src/index.js';

export default defineStub({
    request: openai.chat(),
    response: openai.stream(['Hel', 'lo, ', 'world']),
});
