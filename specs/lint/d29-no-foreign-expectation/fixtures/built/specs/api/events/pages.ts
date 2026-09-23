export function pageOf(page: number): string {
    return `HTTP/1.1 200 OK\n\npage ${page}`;
}
