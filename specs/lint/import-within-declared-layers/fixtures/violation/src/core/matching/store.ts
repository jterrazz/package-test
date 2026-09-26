import { Client } from 'pg';

export function makeClient(): Client {
    return new Client();
}
