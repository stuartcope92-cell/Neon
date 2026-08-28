#!/usr/bin/env node
/**
 * Puts your Supabase database password into .env.local without it appearing on
 * screen, in your shell history, or anywhere else.
 *   npm run db:password
 *
 * Prompts with the input hidden, URL-encodes the password, and substitutes it
 * into DATABASE_URL and DIRECT_URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const ENV_FILE = process.env.ENV_FILE ?? ".env.local";
const PLACEHOLDER = "[YOUR-PASSWORD]";

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Swallow the echo so the password never reaches the screen.
    const hidden = process.stdin.isTTY;
    if (hidden) rl._writeToOutput = () => {};
    process.stdout.write(question);
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

if (!process.stdin.isTTY) {
  console.error("Run this from an interactive terminal so the password can stay hidden.");
  process.exit(1);
}

let contents;
try {
  contents = readFileSync(ENV_FILE, "utf8");
} catch {
  console.error(`${ENV_FILE} not found. Copy .env.example to .env.local first.`);
  process.exit(1);
}

if (!contents.includes(PLACEHOLDER)) {
  console.error(
    `No ${PLACEHOLDER} left in ${ENV_FILE} — the password looks like it's already set.\n` +
      "To change it, paste the connection strings in fresh from Supabase and run this again.",
  );
  process.exit(1);
}

const password = await prompt("Supabase database password (input hidden): ");

if (!password) {
  console.error("Nothing entered, no changes made.");
  process.exit(1);
}

// Encode so @ : / ? # % in the password can't break the connection string.
const encoded = encodeURIComponent(password);
writeFileSync(ENV_FILE, contents.split(PLACEHOLDER).join(encoded));

const occurrences = contents.split(PLACEHOLDER).length - 1;
console.log(`Password written into ${occurrences} connection string(s) in ${ENV_FILE}.`);
if (encoded !== password) console.log("(URL-encoded — it contained characters that needed escaping.)");
console.log("\nNext: npm run db:check");
