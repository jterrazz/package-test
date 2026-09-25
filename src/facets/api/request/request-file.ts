import { parseHeaders, splitSections } from '../../../expectations/http/http-file.js';

export type ParsedRequestFile = {
    body?: string | undefined;
    headers: Record<string, string>;
    method: string;
    path: string;
};

export function parseRequestFile(content: string, fileName: string): ParsedRequestFile {
    const { body, headerLines, startLine } = splitSections(content);

    const start = /^(?<method>[A-Z]+)\s+(?<path>\S+)$/u.exec(startLine.trim());
    const method = start?.groups?.method;
    const path = start?.groups?.path;
    if (method === undefined || path === undefined) {
        throw new Error(
            `${fileName}: first line must be "METHOD /path" (e.g. "POST /users"), got "${startLine}"`,
        );
    }

    return {
        body: body.length > 0 ? body : undefined,
        headers: parseHeaders(headerLines, fileName),
        method,
        path,
    };
}
