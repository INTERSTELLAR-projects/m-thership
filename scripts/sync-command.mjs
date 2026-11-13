// Copies the body of base44/shared/command.js (the Command engine) into src/features/command/engine.js,
// keeping each file's own header. Run after editing the backend copy: npm run sync:command
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "// ---- shared body below (keep identical) ----";
const src = fs.readFileSync(path.join(root, "base44/shared/command.js"), "utf8");
const dstPath = path.join(root, "src/features/command/engine.js");
const dst = fs.readFileSync(dstPath, "utf8");
const body = src.slice(src.indexOf(MARK) + MARK.length);
const head = dst.slice(0, dst.indexOf(MARK) + MARK.length);
fs.writeFileSync(dstPath, head + body);
console.log("synced", dstPath);
