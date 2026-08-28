#!/usr/bin/env node
/**
 * Puts your Supabase database password into .env.local.
 *   npm run db:password
 *
 * In an interactive terminal it prompts with the input hidden. Otherwise it
 * reads the password from stdin, so this also works:
 *   npm run db:password < password.txt
 *
 * Either way the password is URL-encoded and substituted into DATABASE_URL and
 * DIRECT_URL, so characters like @ : / ? # can't break the connection string.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const ENV_FILE = process.env.ENV_FILE ?? ".env.local";
const PLACEHOLDER = "[YOUR-PASSWORD]";

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = () => {}; // swallow the echo
    process.stdout.write(question);
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

function manualInstructions() {
  console.error(
    `\nCouldn't read a password here. Edit ${ENV_FILE} in your editor instead:\n\n` +
      `  Replace ${PLACEHOLDER} on the DATABASE_URL and DIRECT_URL lines with your\n` +
      "  Supabase database password. If it contains @ : / ? # or %, percent-encode it\n" +
      "  (@ becomes %40, # becomes %23, % becomes %25).\n\n" +
      "Then run: npm run db:check\n",
  );
}

let contents;
try {
  contents = readFileSync(ENV_FILE, "utf8");
} catch {
  console.error(`${ENV_FILE} not found. Copy .env.example to .env.local first.`);
  process.exit(1);
}

const occurrences = contents.split(PLACEHOLDER).length - 1;
if (occurrences === 0) {
  console.error(
    `No ${PLACEHOLDER} left in ${ENV_FILE} — the password looks like it's already set.\n` +
      "To change it, paste the connection strings in fresh from Supabase and run this again.",
  );
  process.exit(1);
}

const password = (
  process.stdin.isTTY
    ? await promptHidden("Supabase database password (input hidden): ")
    : await readStdin()
).trim();

if (!password) {
  manualInstructions();
  process.exit(1);
}

// Encode so @ : / ? # % in the password can't break the connection string.
const encoded = encodeURIComponent(password);
writeFileSync(ENV_FILE, contents.split(PLACEHOLDER).join(encoded));

console.log(`Password written into ${occurrences} place(s) in ${ENV_FILE}.`);
if (encoded !== password) {
  console.log("(URL-encoded — it contained characters that needed escaping.)");
}
if (!process.stdin.isTTY) {
  console.log("Note: read from stdin. If you piped it from a file, delete that file now.");
}
console.log("\nNext: npm run db:check");
