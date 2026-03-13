#!/usr/bin/env node
/**
 * Reads .env from the app directory and reports whether EXPO_PUBLIC_SUPABASE_URL
 * and EXPO_PUBLIC_SUPABASE_ANON_KEY are present (no secrets printed).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

const keys = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];

function main() {
  if (!fs.existsSync(envPath)) {
    console.log(".env file: missing");
    keys.forEach((k) => console.log(`${k}: false`));
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, "utf8");
  const seen = {};
  const foundKeys = [];
  for (const line of content.split(/\r?\n/)) {
    // Allow KEY=value or KEY = value; key must not start with #
    const match = line.match(/^\s*([^#=]\S*)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim().replace(/^\uFEFF/, "");
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (key.length > 0) foundKeys.push(key);
      if (value.length > 0) seen[key] = true;
    }
  }

  console.log(".env file: present");
  console.log("Keys found in .env (key names only):", foundKeys.length ? foundKeys.join(", ") : "(none)");
  console.log("Required keys must be exact (case-sensitive) and have non-empty values.");
  console.log("");
  let all = true;
  for (const k of keys) {
    const present = !!seen[k];
    console.log(`${k}: ${present}`);
    if (!present) all = false;
  }
  process.exit(all ? 0 : 1);
}

main();
