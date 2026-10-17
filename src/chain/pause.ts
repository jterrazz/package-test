export async function pause(ms: number): Promise<void> {
    // hazard: a pause of nothing schedules no timer: under a test's stopped scheduler (`clock.run()`) it would never fire.
    if (ms <= 0) {
        return;
    }
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}
