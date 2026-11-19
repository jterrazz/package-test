import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

const DAYS = Array.from({ length: 10 }, (_, index) => index + 1);

function dayUnder(event: PointerEvent): string {
    const square = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-day]');
    return square instanceof HTMLElement ? (square.dataset.day ?? 'out') : 'out';
}

/** A week drawn as ONE image whose squares are found under the pointer; the log says where a drag pressed, passed and released. */
export function WeekGrid({ delay = 0 }: { delay?: number }) {
    const [drawn, setDrawn] = useState(delay === 0);
    const [log, setLog] = useState<string[]>([]);
    const last = useRef<null | string>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDrawn(true);
        }, delay);
        return () => {
            clearTimeout(timer);
        };
    }, [delay]);

    const press = (event: PointerEvent<HTMLDivElement>): void => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const day = dayUnder(event);
        last.current = day;
        setLog((entries) => [...entries, `down ${day}`]);
    };
    const move = (event: PointerEvent): void => {
        const day = dayUnder(event);
        if (last.current === null || day === last.current) {
            return;
        }
        last.current = day;
        setLog((entries) => [...entries, day]);
    };
    const release = (event: PointerEvent): void => {
        const day = dayUnder(event);
        last.current = null;
        setLog((entries) => [...entries, `up ${day}`]);
    };

    return (
        <>
            {drawn && (
                <div
                    aria-label="Week"
                    data-testid="week"
                    onPointerDown={press}
                    onPointerMove={move}
                    onPointerUp={release}
                    role="img"
                    style={{ display: 'flex', width: 200 }}
                >
                    {DAYS.map((day) => (
                        <span data-day={day} key={day} style={{ height: 20, width: 20 }} />
                    ))}
                </div>
            )}
            <p>{log.length === 0 ? 'idle' : log.join(' · ')}</p>
        </>
    );
}
