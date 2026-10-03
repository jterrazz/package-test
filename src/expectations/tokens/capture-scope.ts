/** Named captures of `match.ref()` / `{{type#ref}}`, one scope per spec result. */
export class CaptureScope {
    private readonly values = new Map<string, unknown>();
    /** The spec's working directory when known (cli mode), for `{{workdir}}`. */
    workdir?: string | undefined;

    constructor(workdir?: string) {
        this.workdir = workdir;
    }

    get(name: string): unknown {
        return this.values.get(name);
    }

    has(name: string): boolean {
        return this.values.has(name);
    }

    set(name: string, value: unknown): void {
        this.values.set(name, value);
    }

    /** A copy to try a comparison on: its captures stay there until adopted. */
    fork(): CaptureScope {
        const copy = new CaptureScope(this.workdir);
        for (const [name, value] of this.values) {
            copy.set(name, value);
        }
        return copy;
    }

    /** Take every capture a fork of this scope recorded. */
    adopt(fork: CaptureScope): void {
        for (const [name, value] of fork.values) {
            this.values.set(name, value);
        }
    }
}
