export type Lesson = { fix: string; found: string; why: string };

// outside: Node names a bound port EADDRINUSE, and the frameworks word it as "address already in use" or "port is already in use".
const PORT_IN_USE = /EADDRINUSE|address already in use|port \d+ is already in use/iu;

// invariant: a server that could not bind says so in its output whatever else it printed, and the lesson names the `port` option, the one place a port is chosen.
export function lessonOf(reason: Lesson, output: string, port: number | undefined): Lesson {
    if (!PORT_IN_USE.test(output)) {
        return reason;
    }

    return {
        fix:
            port === undefined
                ? 'have the command listen on the `PORT` it is handed, a free one, or stop the process holding the port it binds'
                : `stop the process holding port ${String(port)}, or drop the \`port\` option so a free one is picked`,
        found: 'the server could not bind its port, which another process already holds',
        why: 'A process is handed a free port unless `port` pins one, and a port another process holds is not free.',
    };
}
