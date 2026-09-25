/** Beside the visible line, a stylesheet's source and an undisplayed node: text a rendered capture must not pick up. */
export function CaptureNote() {
    return (
        <section aria-label="Note">
            <style>{'.note { color: rebeccapurple; }'}</style>
            <p className="note">Shown to the reader</p>
            <p hidden>Drafted, never shown</p>
        </section>
    );
}
