#!/usr/bin/env node
/**
 * Verifies that the Griffel insertion-point anchor precedes Tailwind's injected
 * stylesheet in the actual production build output (frontend/dist/index.html).
 *
 * This is a repeatable, build-time check (not a dev-mode-only assumption) that
 * the Griffel-before-Tailwind cascade-order contract (see
 * .planning/research/ARCHITECTURE.md §3) holds in the real bundle Vite produces.
 *
 * Exit codes: 0 = order verified correct, 1 = order violated or file missing.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndexPath = path.resolve(__dirname, "..", "dist", "index.html");

if (!existsSync(distIndexPath)) {
  console.error(
    `verify-griffel-insertion-order: ${distIndexPath} does not exist. Run "npm run build" first.`
  );
  process.exit(1);
}

const html = readFileSync(distIndexPath, "utf-8");

const anchorIndex = html.indexOf('id="griffel-insertion-point"');

if (anchorIndex === -1) {
  console.error(
    'verify-griffel-insertion-order: could not find the griffel-insertion-point anchor in dist/index.html.'
  );
  process.exit(1);
}

// Find the first Tailwind-injected stylesheet reference in <head> after the anchor.
// Vite's production build injects Tailwind's compiled CSS as a <link rel="stylesheet">
// tag referencing a local built asset (href starting with "/assets/"). This is
// distinct from the pre-existing Google Fonts <link rel="stylesheet"> (an external
// https://fonts.googleapis.com URL, already present in source index.html before this
// plan's anchor) -- we must match only the locally-built CSS bundle, not any
// <link rel="stylesheet"> tag.
const stylesheetLinkMatch = html.match(/<link[^>]*rel="stylesheet"[^>]*href="\/assets\/[^"]*\.css"[^>]*>/);

if (!stylesheetLinkMatch) {
  console.error(
    'verify-griffel-insertion-order: could not find a built <link rel="stylesheet" href="/assets/*.css"> tag in dist/index.html -- expected Vite\'s built Tailwind CSS bundle reference.'
  );
  process.exit(1);
}

const stylesheetIndex = html.indexOf(stylesheetLinkMatch[0]);

if (!(anchorIndex < stylesheetIndex)) {
  console.error(
    `verify-griffel-insertion-order: FAILED. Griffel anchor (index ${anchorIndex}) does not precede ` +
      `Tailwind's stylesheet link (index ${stylesheetIndex}) in dist/index.html.`
  );
  process.exit(1);
}

console.log(
  `verify-griffel-insertion-order: PASSED. Griffel anchor (index ${anchorIndex}) precedes ` +
    `Tailwind's stylesheet link (index ${stylesheetIndex}) in dist/index.html.`
);
process.exit(0);
