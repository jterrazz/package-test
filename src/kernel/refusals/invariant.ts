export function invariant(broken: string): Error {
    return new Error(
        `@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: ${broken}`,
    );
}
