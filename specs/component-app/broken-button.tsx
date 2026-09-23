/** A button whose handler throws — an exception nothing in the page catches. */
export function BrokenButton() {
    return (
        <button
            onClick={() => {
                throw new Error('the handler broke');
            }}
            type="button"
        >
            Break
        </button>
    );
}
