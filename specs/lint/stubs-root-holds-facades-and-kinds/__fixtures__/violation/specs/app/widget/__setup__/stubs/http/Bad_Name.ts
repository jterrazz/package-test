import { defineStub, http } from '@jterrazz/test/stubs';

// A unit stub is named <kebab-name>.ts (`stubs-root-holds-facades-and-kinds`).
export default defineStub({
    request: http.get('https://example.test/bad'),
    response: http.json({ ok: true }),
});
