#!/usr/bin/env node
/**
 * Regenerates src/pdf/logo.ts from public/logo.png.
 *   node scripts/bundle-logo.mjs
 *
 * The PDF renders in a serverless function where public/ isn't reliably readable
 * from disk, so the logo is inlined into the bundle as a data URI.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";

const png = readFileSync("public/logo.png");
if (png.length > 2_000_000) {
  console.error(`public/logo.png is ${(png.length / 1e6).toFixed(1)}MB — shrink it before bundling.`);
  process.exit(1);
}

const header = `/**
 * The company logo, inlined as a data URI.
 *
 * The PDF is rendered inside a serverless function, where files under public/
 * are not reliably present on disk — so the logo ships in the bundle rather than
 * being read from the filesystem or fetched over the network. public/logo.png is
 * the same image, used by the browser UI.
 *
 * To change it: replace public/logo.png and regenerate this file with
 *   node scripts/bundle-logo.mjs
 */
`;

writeFileSync("src/pdf/logo.ts", `${header}export const BUNDLED_LOGO = \`data:image/png;base64,${png.toString("base64")}\`;\n`);
console.log(`Bundled ${png.length} bytes -> src/pdf/logo.ts (${statSync("src/pdf/logo.ts").size} bytes)`);
