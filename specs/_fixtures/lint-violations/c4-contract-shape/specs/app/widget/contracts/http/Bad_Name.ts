import { defineContract, http } from '@jterrazz/test';

// A unit contract is named <kebab-name>.ts (C4).
export default defineContract({
    request: http.get('https://example.test/bad'),
    response: http.json({ ok: true }),
});
