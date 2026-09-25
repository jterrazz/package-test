import { anthropic, defineStub } from '../../../../../src/index.js';

export default defineStub({
    request: anthropic.messages(),
    response: anthropic.stream(['Hel', 'lo, ', 'world']),
});
