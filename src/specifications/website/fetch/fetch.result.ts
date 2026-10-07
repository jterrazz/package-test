import { BaseResult } from '../../../expectations/result.js';
import type { ResultConfig } from '../../../expectations/result.js';
import { JsonAccessor } from '../../../expectations/text/json.js';
import { TextAccessor } from '../../../expectations/text/text.js';

export type FetchExchange = {
    body: string;
    headers: Record<string, string>;
    status: number;
};

/** Result from a raw `.fetch()` action (robots.txt, sitemaps, redirects). */
export class FetchResult extends BaseResult {
    private readonly exchange: FetchExchange;

    constructor(options: { config: ResultConfig; exchange: FetchExchange; testDir: string }) {
        super(options);
        this.exchange = options.exchange;
    }

    /** The response body as a text accessor (`toMatch(file('./__expected__/robots.txt'))`, `.grep()`). */
    get body(): TextAccessor {
        return new TextAccessor(this.exchange.body, 'body', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** Response headers as a flat, lower-cased key-value map. */
    get headers(): Record<string, string> {
        return this.exchange.headers;
    }

    /** The response body parsed as JSON. */
    get json(): JsonAccessor {
        return new JsonAccessor(this.exchange.body, 'body', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** The `location` header of a redirect response, or undefined. */
    get location(): string | undefined {
        return this.exchange.headers.location;
    }

    /** The HTTP response status code — redirects surface as 3xx, never followed. */
    get status(): number {
        return this.exchange.status;
    }
}
