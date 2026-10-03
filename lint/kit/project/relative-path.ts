export function isRelativePath(value: string): boolean {
    return value.startsWith('./') || value.startsWith('../');
}
