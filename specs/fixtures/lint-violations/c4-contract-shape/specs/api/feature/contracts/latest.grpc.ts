import { defineContract, http } from '@jterrazz/test';

// Provider suffix "grpc" is not one of openai | anthropic | http (C4).
export default defineContract({
    response: http.json({ ok: true }),
    trigger: http.get('https://example.test/latest'),
});
