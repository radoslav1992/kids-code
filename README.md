# Kids Code

A colorful, kid-centered Astro website for learning programming through play.

## What's inside

- 8 animated robot missions: sequencing, repetition, decomposition, and debugging.
- Pixel art studio: 12×12 canvas, coordinates, symmetry, undo, local saving, and SVG download.
- 8-question debugging and code-prediction activity with explanations.
- 10 Python lessons with editable code, hints, solutions, and output goals.
- A real Python playground with input, error feedback, Stop, local drafts, and `.py` download.
- 4 Python project starters, an 18-term glossary, progress collection, FAQs, and a parent/teacher guide.
- 21 static HTML pages. Responsive layouts, keyboard controls, reduced motion, and original SVG robot artwork.

## Develop and deploy

Use Node.js 22+ and Python 3 for the curriculum tests.

```sh
npm ci
npm run dev
npm test
npm run build
npm run check
```

Cloudflare Pages / Workers static assets: build command `npm run build`; output directory `dist`.
No server, database, login, or API key is required.

**Before production launch, set `SITE_URL` to the final purchased domain** (for example `https://your-chosen-domain.com`) in the build environment. This enables canonical URLs, `sitemap-index.xml`, and the sitemap reference in `robots.txt`. No unowned production domain is assumed. A build with `SITE_URL` should contain 20 sitemap page URLs, excluding the 404 page.

## Python execution

`public/python-worker.mjs` lazily loads pinned Pyodide 314.0.7 from jsDelivr on the first Run. The module worker keeps Python off the UI thread. UI-side termination handles Stop, loading failure (90 seconds), and runaway code (10 seconds of execution). The worker limits printed output to 30,000 characters and code to 50,000 characters. Each run receives a fresh Python globals dictionary. The runtime is reused until stopped or an error occurs.

Input is supplied before running: each line in Program input is consumed by one `input()` call. The editor supports the Python standard library; it does not offer package installation, desktop GUIs, or turtle graphics. This is not a security sandbox for untrusted programs: Python can access worker web APIs. There are no application credentials or accounts.

Official integration references:
- https://pyodide.org/en/stable/usage/webworker.html
- https://pyodide.org/en/stable/usage/streams.html

## Data and external resources

No analytics, ads, user accounts, chat, or uploads. Progress, Python drafts, and pixel art are stored in localStorage on the device, with graceful handling when storage is unavailable. Clear site data to remove everything; Explore's reset clears completed activities only.

Fonts load from Google Fonts; Python loads from jsDelivr. Code is executed on the device, not submitted to an execution server. The parent guide explains external requests and data behavior.

## Validation

`npm test` covers all mission solutions, obstacle/boundary behavior, all lesson solutions, all project starters, and quiz data. `npm run check` checks the generated HTML for unique titles, one H1, metadata, duplicate IDs, valid JSON-LD, and internal links/assets. Browser appearance should be checked on the deployed URL at desktop and mobile widths; the authoring environment's cloud browser cannot reach the local preview.
