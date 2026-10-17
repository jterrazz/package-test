import { defineStub, http } from '@jterrazz/test/stubs';

// "grpc" is not a provider directory (`stubs-root-holds-facades-and-kinds`).
export default defineStub({
    request: http.get('https://example.test/thing'),
    response: http.json({ ok: true }),
});
