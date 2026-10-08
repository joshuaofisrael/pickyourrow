import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = 'https://pickyourrow.com';

/** Retired guide URLs and the thank you page stay out of the sitemap. */
const unlisted = new Set([
  `${site}/contact/thanks/`,
  `${site}/guides/connecting-flights-seat-strategy/`,
  `${site}/guides/window-versus-aisle-tradeoffs/`,
  `${site}/guides/overnight-red-eye-seat-picks/`,
  `${site}/guides/bassinet-rows-and-family-seating/`,
]);

export default defineConfig({
  site,
  trailingSlash: 'always',
  redirects: {
    '/guides/connecting-flights-seat-strategy/': '/guides/connecting-flight-seat-strategy/',
    '/guides/window-versus-aisle-tradeoffs/': '/guides/aisle-vs-window/',
    '/guides/overnight-red-eye-seat-picks/': '/guides/red-eye-seat-strategy/',
    '/guides/bassinet-rows-and-family-seating/': '/guides/bassinet-bulkhead-seats/',
  },
  integrations: [
    sitemap({
      filter: (page) => !unlisted.has(page),
      // llms.txt is a static file in public/, so it is listed by hand.
      customPages: [`${site}/llms.txt`],
    }),
  ],
});
