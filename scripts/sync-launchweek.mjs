// Copies the body of base44/shared/launchWeek.js (the Launch Week core) into src/features/launchweek/core.js,
// keeping each file's own header. Run after editing the backend copy: npm run sync:launchweek
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "// ---- shared body below (keep identical) ----";
const src = fs.readFileSync(path.join(root, "base44/shared/launchWeek.js"), "utf8");
const dstPath = path.join(root, "src/features/launchweek/core.js");
const head = fs.existsSync(dstPath) && fs.readFileSync(dstPath, "utf8").includes(MARK)
  ? fs.readFileSync(dstPath, "utf8").split(MARK)[0] + MARK
  : "// Launch Week core for the browser (QA mode and offline). Generated from base44/shared/launchWeek.js:\n// edit that file, then run npm run sync:launchweek.\n" + MARK;
fs.writeFileSync(dstPath, head + src.slice(src.indexOf(MARK) + MARK.length));
console.log("synced", dstPath);
