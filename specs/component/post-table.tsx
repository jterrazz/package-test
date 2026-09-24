import { useEffect, useState } from 'react';

type Post = { id: number; title: string };

/** A table that asks the network for its rows — the contract-shaped component. */
export function PostTable() {
    const [posts, setPosts] = useState<null | Post[]>(null);
    const [total, setTotal] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        const load = async (): Promise<void> => {
            const response = await fetch('/api/posts');
            if (!response.ok) {
                throw new Error(`the collection answered ${response.status}`);
            }
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a JSON body is `any` by construction, and naming its shape here IS what the contract beside this file declares
            const body = (await response.json()) as { posts: Post[]; total: number };
            if (alive) {
                setPosts(body.posts);
                setTotal(body.total);
            }
        };
        void (async () => {
            try {
                await load();
            } catch {
                if (alive) {
                    setFailed(true);
                }
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    if (failed) {
        return <p>Could not load posts</p>;
    }
    if (posts === null) {
        return <p>Loading…</p>;
    }

    return (
        <section aria-label="Posts">
            <h1>Posts</h1>
            <table>
                <caption>
                    Showing {posts.length} of {total} posts
                </caption>
                <thead>
                    <tr>
                        <th>Title</th>
                    </tr>
                </thead>
                <tbody>
                    {posts.map((post) => (
                        <tr key={post.id}>
                            <td>{post.title}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
