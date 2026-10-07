import { afterAll, test } from 'vitest';

const { specification } = await import(process.env.IN_PLACE_ENTRY);
const { cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.specimen' },
    root: './app',
});

afterAll(cleanup);

test('the run is killed with its session open', async () => {
    await mobile.open();
    process.kill(process.ppid, 'SIGKILL');
    process.kill(process.pid, 'SIGKILL');
});
