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
