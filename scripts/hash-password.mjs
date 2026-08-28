#!/usr/bin/env node
/**
 * Generates the ADMIN_PASSWORD_HASH value for .env.local / Vercel env vars.
 *   npm run hash-password -- "your-password"
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";

const scrypt = promisify(scryptCb);

const argPassword = process.argv[2];
let password = argPassword;

if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Password: ");
  rl.close();
}

if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);

console.log("\nAdd this to .env.local (and your Vercel environment variables):\n");
console.log(`ADMIN_PASSWORD_HASH="scrypt:${salt.toString("hex")}:${derived.toString("hex")}"`);
console.log(
  `\nSESSION_SECRET="${randomBytes(32).toString("hex")}"   # only if you don't have one yet\n`,
);
