import { defineContract, http } from '@jterrazz/test';

// A unit contract at the contracts/ ROOT — the root holds only *.contracts.ts (C4).
export default defineContract({
    request: http.get('https://example.test/latest'),
    response: http.json({ ok: true }),
});
