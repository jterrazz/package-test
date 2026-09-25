/**
 * A panel whose wrapper carries a test id and NO role: the one case `testId()`
 * exists for — a container with no landmark to scope on.
 */
export function BarePanel() {
    return (
        <div data-testid="panel-body">
            <p>Panel</p>
        </div>
    );
}
