class Probe {
    expect(line: string): boolean {
        return line.startsWith('Built');
    }
}

export function builtLine(stdout: string): string | undefined {
    return stdout.split('\n').find((line) => new Probe().expect(line));
}
