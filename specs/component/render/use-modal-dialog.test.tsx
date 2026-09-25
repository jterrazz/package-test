import { button, component, dialog, focused } from '@jterrazz/test';
import { StrictMode, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { expect, test, vi } from 'vitest';

import { useModalDialog } from './use-modal-dialog.js';

/**
 * The Given of a hook spec is a HOST written here, in the test file: a hook has
 * no surface of its own, so the component carrying the states the test needs is
 * part of the test, not of the app.
 *
 * The dialog is its own component because the hook opens what it is GIVEN: the
 * effect runs when the thing holding the ref mounts, which is exactly how a
 * modal is written in an app.
 */
function Modal({
    fallback,
    onClose,
}: {
    fallback: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}) {
    const ref = useModalDialog(onClose, fallback);
    return (
        <dialog aria-label="Host" ref={ref}>
            <button type="button">Inside</button>
        </dialog>
    );
}

function Host({ onClose, withOpener = true }: { onClose: () => void; withOpener?: boolean }) {
    const [open, setOpen] = useState(false);
    const fallback = useRef<HTMLButtonElement>(null);

    return (
        <>
            {withOpener ? (
                <button
                    onClick={() => {
                        setOpen(true);
                    }}
                    type="button"
                >
                    Open
                </button>
            ) : null}
            <button ref={fallback} type="button">
                New post
            </button>
            {open ? (
                <Modal
                    fallback={fallback}
                    onClose={() => {
                        setOpen(false);
                        onClose();
                    }}
                />
            ) : null}
        </>
    );
}

test('gives the keyboard back to whatever opened it', async () => {
    // Given - a dialog opened from a button and dismissed by the platform
    const onClose = vi.fn<() => void>();
    await component.render(<Host onClose={onClose} />, async (visitor) => {
        await visitor.click(button('Open'));
        await visitor.see(dialog('Host'));
        await visitor.press('Escape');
        await visitor.gone(dialog('Host'));
        await visitor.see(focused(button('Open')));
    });

    // Then - the owner heard the dismissal exactly once
    expect(onClose).toHaveBeenCalledOnce();
});

test('falls back to another target when the opener has left the screen', async () => {
    // Given - a host with no opener at all, so focus has nowhere to return to
    const onClose = vi.fn<() => void>();
    await component.render(<Host onClose={onClose} withOpener={false} />, async (visitor) => {
        await visitor.see(button('New post'));
    });

    // Then - nothing was dismissed, so nothing was reported
    expect(onClose).not.toHaveBeenCalled();
});

test('reports the latest handler a parent gave it, not the first', async () => {
    // Given - a dialog opened under one handler and dismissed under another
    const first = vi.fn<() => void>();
    const second = vi.fn<() => void>();
    await component.render(<Host onClose={first} />, async (visitor) => {
        await visitor.click(button('Open'));
        await visitor.see(dialog('Host'));
        await visitor.rerender(<Host onClose={second} />);
        await visitor.press('Escape');
        await visitor.gone(dialog('Host'));
    });

    // Then - only the handler in force at dismissal heard it
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
});

test('reports nothing when the parent takes it off the screen itself', async () => {
    // Given - a dialog the parent unmounts rather than the platform dismissing
    const onClose = vi.fn<() => void>();
    await component.render(<Host onClose={onClose} />, async (visitor) => {
        await visitor.click(button('Open'));
        await visitor.see(dialog('Host'));
        await visitor.unmount();
    });

    // Then - an unmount is not a dismissal, and the owner was told nothing
    expect(onClose).not.toHaveBeenCalled();
});

test('holds its contract under the <StrictMode> a chain wraps the tree in', async () => {
    // Given - the same host inside <StrictMode>: the extra checks React runs under it must not turn one dismissal into two, nor lose the opener
    const onClose = vi.fn<() => void>();
    await component
        .wrap((ui) => <StrictMode>{ui}</StrictMode>)
        .render(<Host onClose={onClose} />, async (visitor) => {
            await visitor.click(button('Open'));
            await visitor.see(dialog('Host'));
            await visitor.press('Escape');
            await visitor.gone(dialog('Host'));
            await visitor.see(focused(button('Open')));
        });

    // Then - one dismissal, and the keyboard back where it came from
    expect(onClose).toHaveBeenCalledOnce();
});
