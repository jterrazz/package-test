import { defineStub, http } from '@jterrazz/test';

// A unit stub at the stubs/ ROOT — the root holds only *.stubs.ts (`stubs-root-holds-facades-and-kinds`).
export default defineStub({
    request: http.get('https://example.test/latest'),
    response: http.json({ ok: true }),
});
