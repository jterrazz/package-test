import { Link, useParams } from 'react-router';

export function Nav() {
    const { slug } = useParams();
    return (
        <nav aria-label="Reader">
            <Link to="/posts">Posts</Link>
            <p>Reading: {slug}</p>
        </nav>
    );
}
