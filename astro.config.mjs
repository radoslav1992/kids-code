import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
// Set SITE_URL to the purchased domain in the deployment environment.
const site = process.env.SITE_URL;
export default defineConfig({site, output:'static', trailingSlash:'always', integrations:site ? [sitemap({filter:page=>!/\/404(?:\/|\.html)?$/.test(page)})] : []});
