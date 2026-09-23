import { defineContract, http } from '@jterrazz/test';

// "grpc" is not a provider directory (C4).
export default defineContract({
    request: http.get('https://example.test/thing'),
    response: http.json({ ok: true }),
});
