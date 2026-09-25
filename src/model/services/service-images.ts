/**
 * The image each container-backed service starts from when its handle states
 * none: the slim variant, pinned by the digest of its multi-platform index so
 * every machine and every run starts the same bytes. A tag alone moves under
 * the suite; the digest is what changes when the pin is bumped, by hand.
 */
export const SERVICE_IMAGES = {
    postgres:
        'postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24',
    redis: 'redis:7-alpine@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499',
} as const;
