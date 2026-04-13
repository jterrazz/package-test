#!/bin/bash
# Generate llms.txt and llms-full.txt from typedoc markdown output.
# Run after: npx typedoc

DOCS_DIR=".docs"
OUT_DIR=".docs"

# llms.txt — structured index with links
cat > "$OUT_DIR/llms.txt" << 'HEADER'
# @jterrazz/test

> Declarative testing framework for APIs and CLIs. Same fluent builder, three execution modes.

## API Reference

HEADER

# Add index entries from the generated index.md
sed -n '/^## /,$ p' "$DOCS_DIR/index.md" >> "$OUT_DIR/llms.txt"

# llms-full.txt — all docs concatenated
{
    echo "# @jterrazz/test — Full API Reference"
    echo ""
    echo "> Declarative testing framework for APIs and CLIs."
    echo "> Three modes: integration() for in-process Hono + testcontainers,"
    echo "> e2e() for full docker compose, cli() for command execution."
    echo ""

    # Concatenate all markdown files
    for f in "$DOCS_DIR"/index.md \
             "$DOCS_DIR"/functions/*.md \
             "$DOCS_DIR"/classes/*.md \
             "$DOCS_DIR"/interfaces/*.md \
             "$DOCS_DIR"/type-aliases/*.md \
             "$DOCS_DIR"/variables/*.md; do
        [ -f "$f" ] || continue
        echo "---"
        echo ""
        cat "$f"
        echo ""
    done
} > "$OUT_DIR/llms-full.txt"

echo "Generated $OUT_DIR/llms.txt and $OUT_DIR/llms-full.txt"
