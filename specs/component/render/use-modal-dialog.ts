import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Open a `<dialog>` as a modal while it is mounted, report the platform's own
 * dismissal once, and give the keyboard back to whatever opened it.
 *
 * The hook is the subject; the component that hosts it is written in the test,
 * because a hook has no surface of its own to render.
 */
export function useModalDialog(
    onClose: () => void,
    fallback?: RefObject<HTMLElement | null>,
): RefObject<HTMLDialogElement | null> {
    const dialog = useRef<HTMLDialogElement>(null);
    const opener = useRef<Element | null>(null);
    const latest = useRef(onClose);
    latest.current = onClose;

    useEffect(() => {
        const element = dialog.current;
        const handle = (): void => {
            latest.current();
        };
        if (element !== null) {
            opener.current = document.activeElement;
            element.showModal();
            element.addEventListener('close', handle);
        }
        return () => {
            element?.removeEventListener('close', handle);
            const target = opener.current ?? fallback?.current;
            if (target instanceof HTMLElement && target.isConnected) {
                target.focus();
            }
        };
    }, [fallback]);

    return dialog;
}
