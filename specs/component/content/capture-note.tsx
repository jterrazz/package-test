/**
 * A note carrying, beside the line a reader sees, the two kinds of text a
 * rendered capture must not pick up: a stylesheet's source, and a node the
 * page does not display.
 */
export function CaptureNote() {
    return (
        <section aria-label="Note">
            <style>{'.note { color: rebeccapurple; }'}</style>
            <p className="note">Shown to the reader</p>
            <p hidden>Drafted, never shown</p>
        </section>
    );
}
