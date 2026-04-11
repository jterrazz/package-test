import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

export default defineConfig({
  title: "@jterrazz/test",
  description: "Declarative testing framework for APIs and CLIs",
  base: "/package-test/",
  cleanUrls: true,
  lastUpdated: true,

  head: [["link", { rel: "icon", href: "/package-test/favicon.ico" }]],

  vite: {
    plugins: [llmstxt()],
  },

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guides/overview" },
      { text: "Reference", link: "/reference/" },
      {
        text: "Links",
        items: [
          { text: "npm", link: "https://www.npmjs.com/package/@jterrazz/test" },
          {
            text: "Changelog",
            link: "https://github.com/jterrazz/package-test/blob/main/CHANGELOG.md",
          },
          { text: "GitHub", link: "https://github.com/jterrazz/package-test" },
        ],
      },
    ],

    sidebar: {
      "/guides/": [
        {
          text: "Guide",
          items: [
            { text: "Overview", link: "/guides/overview" },
            { text: "Writing tests", link: "/guides/writing-tests" },
          ],
        },
        {
          text: "Runners",
          items: [
            { text: "integration()", link: "/guides/integration" },
            { text: "e2e()", link: "/guides/e2e" },
            { text: "cli()", link: "/guides/cli" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Overview", link: "/reference/" },
            { text: "Functions", link: "/reference/functions/" },
            { text: "Classes", link: "/reference/classes/" },
            { text: "Interfaces", link: "/reference/interfaces/" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/jterrazz/package-test" }],

    editLink: {
      pattern: "https://github.com/jterrazz/package-test/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Jean-Baptiste Terrazzoni",
    },
  },

  ignoreDeadLinks: [
    // Typedoc-plugin-markdown relative links use .md suffix which VitePress cleanUrls strips
    /\.md($|#)/,
  ],
});
