# KidsCode

A colorful, kid-centered Astro website for learning programming through play, published at https://kidscode.dev.

## What's inside

- 8 animated robot missions: sequencing, repetition, decomposition, and debugging.
- Pixel art studio: 12×12 canvas, coordinates, symmetry, undo, local saving, and SVG download.
- 8-question debugging and code-prediction activity with explanations.
- 10 Python lessons with editable code, hints, solutions, and output goals.
- A real Python playground with input, error feedback, Stop, local drafts, and `.py` download.
- 4 Python project starters, a 28-term glossary, progress collection, FAQs, a parent/teacher guide, and a printable one-hour coding plan (`/one-hour-coding/`) with three timed routes for classrooms, clubs, and home.
- 20 guided Blockly missions, a free block playground, live variable watchers, local project files, and a Python bridge.
- 45 static HTML pages. Responsive layouts, keyboard controls, reduced motion, and original SVG robot artwork.

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

The production domain is **https://kidscode.dev**, configured directly in `astro.config.mjs`. Every build generates canonical URLs, `sitemap-index.xml`, and the sitemap reference in `robots.txt` for this domain; no `SITE_URL` environment variable is needed. The sitemap contains 43 page URLs, excluding the 404 page (which is also `noindex`).

`src/layouts/Layout.astro` appends the `KidsCode` brand to page titles and emits Open Graph tags plus JSON-LD: WebSite and Organization on the home page, and BreadcrumbList on nested pages. `src/lib/seo.mjs` builds Course data for the `/blocks/` and `/python/` trails and LearningResource data for each lesson. Pages with a visible FAQ add FAQPage data through `src/components/Faq.astro`.

## Python execution

`public/python-worker.mjs` lazily loads pinned Pyodide 314.0.7 from jsDelivr on the first Run. The module worker keeps Python off the UI thread. UI-side termination handles Stop, loading failure (90 seconds), and runaway code (10 seconds of execution). The worker limits printed output to 30,000 characters and code to 50,000 characters. Each run receives a fresh Python globals dictionary. The runtime is reused until stopped or an error occurs.

Input is supplied before running: each line in Program input is consumed by one `input()` call. The editor supports the Python standard library; it does not offer package installation, desktop GUIs, or turtle graphics. This is not a security sandbox for untrusted programs: Python can access worker web APIs. There are no application credentials or accounts.

Official integration references:
- https://pyodide.org/en/stable/usage/webworker.html
- https://pyodide.org/en/stable/usage/streams.html

## Data and external resources

Google Analytics (`G-S48T3RS4FW`) is included once in the shared page layout to measure visits and site usage. No ads, user accounts, chat, or uploads. Progress, Python drafts, and pixel art are stored in localStorage on the device, with graceful handling when storage is unavailable. Clear site data to remove everything; Explore's reset clears completed activities only.

Privacy and cookie consent: `/privacy/` explains accounts (none), local storage keys, Google Analytics, and the cookie choice in plain language, and is linked from the footer and the grown-ups guide. `src/components/ConsentDefaults.astro` runs first in `<head>`, before the Google tag, and sets Google Consent Mode v2 defaults: analytics and ad storage are denied by default in the EEA, the UK, and Switzerland and granted elsewhere, and a saved choice (`cookieConsent` in localStorage, kept 180 days) is restored. Visitors whose time zone is in Europe see `src/components/ConsentBanner.astro` (rendered with `ads={false}`, so it mentions statistics only): a small, non-blocking banner with equally weighted Accept and Reject buttons. Until they accept, or after Reject, Google Analytics runs without cookies. *Cookie settings* in the footer reopens the banner.

Fonts load from Google Fonts; Python loads from jsDelivr. Code is executed on the device, not submitted to an execution server. The parent guide explains external requests and data behavior.

## Validation

`npm test` covers all mission solutions, obstacle/boundary behavior, all lesson solutions, all project starters, and quiz data. `npm run check` checks the generated HTML for unique titles, one H1, metadata, duplicate IDs, valid JSON-LD, and internal links/assets. Browser appearance should be checked on the deployed URL at desktop and mobile widths; the authoring environment's cloud browser cannot reach the local preview.

## Block Lab

The `/blocks/` foundations trail uses pinned Blockly 13.3.0, bundled locally and loaded only by editor pages. It is an independent Scratch-style experience, not a Scratch embed. Twenty missions cover primitive values, numbers/text/booleans/absence, variables, expressions, comparisons, if/else, boolean operators, repeat/while/nested loops, lists/indexing/iteration, records/dictionaries, stacks/queues, simple functions, inputs, debugging, and a capstone algorithm.

`src/lib/blocks/definitions.mjs` defines the custom Blockly blocks. `curriculum.mjs` contains task explanations, starter workspaces, solutions, required concepts, and multiple test inputs where relevant. `engine.mjs` compiles connected blocks into a restricted tree and interprets only supported operations—no eval, Function constructor, generated JavaScript, network calls, or arbitrary code execution. Runs have a 2,000-step budget, 15-second watchdog, cancellation, and depth/collection/output limits. The interpreter yields between instructions so Stop stays usable. Live runs highlight blocks and display variables and output. Task checks run their own input scenarios and require relevant block operations. These are practice checks, not a comprehensive assessment of understanding.

Projects auto-save per lesson in localStorage, including inputs. JSON export/import is versioned, size-limited, type-checked, and never auto-runs. Restoring an imported workspace requires a replace confirmation. Undo/redo and starter reset are supported. Blockly supports pointer/touch editing; the canvas is easier on a larger screen, and it uses a horizontal toolbox on narrow screens. We do not claim full keyboard-only editing for the block canvas.

`python.mjs` exports standalone Python and can transfer it to the Python playground after confirming replacement of its old draft. Recipe blocks are parameterless functions with shared variables. The Python bridge preserves all curriculum examples; general Python type semantics can differ (for example equality across types or negative indexes). The Python lessons introduce native syntax, parameters, and return values.

`prebuild` / `predev` copy Blockly media and its Apache-2.0 license from the installed package into `public/blockly-media/` (generated, gitignored). Blockly itself is unmodified; our own application code is in `src/lib/blocks/` and `src/scripts/blocks.ts`.

Block tests load actual Blockly workspaces headlessly, execute every solution/test scenario, reject incomplete starters, round-trip serialization, and run exported Python with CPython. They also cover type errors, wrong indexes, missing inputs/values, disconnected blocks, cancellation, runaway loops/recursion, cyclic collections, growth limits, and invalid imports. Visual browser QA remains unavailable in the authoring environment because the local preview is blocked.
