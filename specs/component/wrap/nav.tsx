import { Link, useParams } from 'react-router';

/** A component that cannot render without a router — the chain's `.wrap()` subject. */
export function Nav() {
    const { slug } = useParams();
    return (
        <nav aria-label="Reader">
            <Link to="/posts">Posts</Link>
            <p>Reading: {slug}</p>
        </nav>
    );
}
