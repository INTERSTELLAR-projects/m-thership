#!/usr/bin/env node
// Pre-release checks for Base44 apps (Interstellar Strategies).
// Runs: build, lint, backend function checks, entity schema/RLS checks,
// secret scan, dist hygiene, route smoke test (vite preview) and perf budget.
//
// Usage:
//   node scripts/release-check.mjs              full run (builds first)
//   node scripts/release-check.mjs --skip-build reuse existing dist/
//   node scripts/release-check.mjs --fast       skip deno type check
// Per-app settings live in scripts/release-check.config.json.
// Mark an intentional secret-scan false positive with a "release-check:allow" comment on that line.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const DEFAULTS = {
  kind: 'app', // 'website' = public site: meta description + no Google Fonts are hard failures
  mainJsBudgetKB: null, // raw KB of the entry chunk; null = report only
  imageWarnKB: 500,
  failOnGoogleFonts: null, // null = fail only when kind === 'website'
  previewPort: 4317,
  extraRoutes: [],
  skipRoutes: [],
  denoCheck: true,
};
const cfgPath = path.join(ROOT, 'scripts', 'release-check.config.json');
const CFG = { ...DEFAULTS, ...(fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {}) };
if (CFG.failOnGoogleFonts === null) CFG.failOnGoogleFonts = CFG.kind === 'website';

const results = [];
const rec = (name, status, detail = '') => {
  results.push({ name, status, detail });
  const tag = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : status === 'skip' ? 'SKIP' : 'FAIL';
  console.log(`\n[${tag}] ${name}${detail ? '\n  ' + String(detail).split('\n').join('\n  ') : ''}`);
};
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
function walk(dir, out = [], skip = new Set(['node_modules', '.git', 'dist', '.vite'])) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, skip);
    else out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p);

// ---------- 1. build ----------
function checkBuild() {
  if (ARGS.has('--skip-build') && exists('dist/index.html')) return rec('build (vite build)', 'skip', 'reused existing dist/');
  const t = Date.now();
  const r = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = strip((r.stdout || '') + (r.stderr || ''));
  if (r.status !== 0) return rec('build (vite build)', 'fail', out.split('\n').slice(-25).join('\n'));
  rec('build (vite build)', 'pass', `${((Date.now() - t) / 1000).toFixed(1)}s`);
}

// ---------- 2. lint ----------
function checkLint() {
  if (!['eslint.config.js', 'eslint.config.mjs', '.eslintrc.cjs', '.eslintrc.json'].some(exists)) return rec('lint (eslint, 0 errors)', 'skip', 'no eslint config');
  const r = spawnSync('npx', ['eslint', '.', '--quiet'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = strip((r.stdout || '') + (r.stderr || '')).trim();
  if (r.status === 0) return rec('lint (eslint, 0 errors)', 'pass');
  rec('lint (eslint, 0 errors)', 'fail', out.split('\n').slice(0, 40).join('\n'));
}

// ---------- 3. backend functions ----------
// TS codes that mean a real runtime problem (undefined name, missing module/export, syntax).
const BLOCKING_TS = new Set(['TS2304', 'TS2552', 'TS2307', 'TS2305', 'TS2724', 'TS2614', 'TS2306', 'TS2300', 'TS2451', 'TS2448', 'TS2454']);
async function checkFunctions() {
  const fnRoot = path.join(ROOT, 'base44', 'functions');
  if (!fs.existsSync(fnRoot)) return rec('backend functions', 'skip', 'no base44/functions');
  const dirs = fs.readdirSync(fnRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const problems = [];
  const entries = [];
  for (const d of dirs) {
    const entry = ['entry.ts', 'entry.js', 'index.ts', 'index.js'].map((f) => path.join(fnRoot, d, f)).find((f) => fs.existsSync(f));
    if (!entry) { problems.push(`${d}: no entry.ts`); continue; }
    entries.push(entry);
    if (!/Deno\.serve\s*\(|export\s+default\b/.test(fs.readFileSync(entry, 'utf8'))) problems.push(`${rel(entry)}: no Deno.serve() / export default handler`);
  }
  // syntax check with esbuild (ships with vite)
  let esbuild = null;
  try { esbuild = await import('esbuild'); } catch { /* optional */ }
  const files = [...walk(fnRoot), ...walk(path.join(ROOT, 'base44', 'shared'))].filter((f) => /\.(m?[jt]sx?)$/.test(f));
  let viteMod = null;
  if (!esbuild) { try { viteMod = await import('vite'); } catch { /* optional */ } }
  const lang = (f) => (f.endsWith('tsx') ? 'tsx' : f.endsWith('jsx') ? 'jsx' : /\.m?ts$/.test(f) ? 'ts' : 'js');
  for (const f of files) {
    const code = fs.readFileSync(f, 'utf8');
    try {
      if (esbuild) esbuild.transformSync(code, { loader: lang(f), format: 'esm', sourcefile: rel(f) });
      else if (viteMod?.transformWithOxc) await viteMod.transformWithOxc(code, f, { lang: lang(f) });
      else if (viteMod?.transformWithEsbuild) await viteMod.transformWithEsbuild(code, f, { loader: lang(f) });
    } catch (e) {
      problems.push(`${rel(f)}: syntax error: ${strip(String(e.message)).split('\n').slice(0, 3).join(' ')}`);
    }
  }
  const parser = esbuild ? 'esbuild' : viteMod?.transformWithOxc ? 'oxc' : viteMod?.transformWithEsbuild ? 'esbuild' : null;
  if (problems.length) return rec(`backend functions (${dirs.length})`, 'fail', problems.join('\n'));
  rec(`backend functions: syntax (${dirs.length} functions, ${files.length} files)`, parser ? 'pass' : 'warn', parser ? `parsed with ${parser}` : 'no parser found; syntax not checked');

  // type/resolve check with deno (blocking only on real-bug codes)
  const hasDeno = spawnSync('deno', ['--version'], { encoding: 'utf8' }).status === 0;
  if (!CFG.denoCheck || ARGS.has('--fast') || process.env.RELEASE_SKIP_DENO) return rec('backend functions: deno check', 'skip', 'disabled (--fast / config)');
  if (!hasDeno) return rec('backend functions: deno check', 'skip', 'deno not installed');
  const cacheDir = path.join(os.tmpdir(), 'release-check-deno');
  fs.mkdirSync(cacheDir, { recursive: true });
  const conf = path.join(cacheDir, 'deno.json');
  fs.writeFileSync(conf, JSON.stringify({ nodeModulesDir: 'auto', compilerOptions: { strict: false, noImplicitAny: false, checkJs: false } }));
  const r = await run('deno', ['check', '--quiet', '--config', conf, ...entries.map(rel)], 420000);
  const out = strip(r.out);
  if (r.code === 0) return rec('backend functions: deno check', 'pass');
  const lines = out.split('\n');
  const blocking = [];
  let other = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(TS\d+) \[ERROR\]: (.*)/);
    if (m) {
      const at = lines.slice(i, i + 12).find((l) => /^\s+at file:\/\//.test(l)) || '';
      const loc = at.trim().replace(/^at file:\/\//, '').replace(ROOT + '/', '');
      if (BLOCKING_TS.has(m[1]) || /^TS1\d{3}$/.test(m[1])) blocking.push(`${m[1]} ${m[2]} @ ${loc}`);
      else other++;
    } else if (/^error: /.test(lines[i]) && !/Type checking failed/.test(lines[i])) {
      const msg = lines[i] + ' ' + (lines[i + 1] || '').trim();
      if (/Module not found|Relative import|Unable to load|not found|Expected/.test(msg) && !/registry|fetch|network|dns|connect/i.test(msg)) blocking.push(msg);
      else if (/registry|fetch|network|dns|connect/i.test(msg)) return rec('backend functions: deno check', 'warn', 'could not download dependencies (network): ' + msg.slice(0, 200));
    }
  }
  if (r.timedOut) return rec('backend functions: deno check', 'warn', 'timed out');
  if (blocking.length) return rec('backend functions: deno check', 'fail', [...new Set(blocking)].slice(0, 40).join('\n'));
  rec('backend functions: deno check', other ? 'warn' : 'pass', other ? `${other} non-blocking type-strictness diagnostics (implicit any, loose object types); no undefined names or missing imports` : '');
}

// ---------- 4. entities ----------
function stripJsonc(src) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += n; i++; } else if (c === '"') inStr = false;
    } else if (c === '"') { inStr = true; out += c; } else if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; } else if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}
function checkEntities() {
  const dir = path.join(ROOT, 'base44', 'entities');
  if (!fs.existsSync(dir)) return rec('entities', 'skip', 'no base44/entities');
  const files = fs.readdirSync(dir).filter((f) => /\.jsonc?$/.test(f));
  const bad = [];
  const names = new Map();
  for (const f of files) {
    let j;
    try { j = JSON.parse(stripJsonc(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch (e) { bad.push(`${f}: does not parse (${e.message})`); continue; }
    if (!j.name || !/^[A-Za-z0-9]+$/.test(j.name)) bad.push(`${f}: missing/invalid "name"`);
    if (names.has(j.name)) bad.push(`${f}: duplicate entity name ${j.name} (also ${names.get(j.name)})`);
    names.set(j.name, f);
    if (!j.properties || typeof j.properties !== 'object') bad.push(`${f}: no "properties"`);
    for (const r of j.required || []) if (j.properties && !(r in j.properties)) bad.push(`${f}: required field "${r}" not in properties`);
    if (j.name !== 'User' && (!j.rls || typeof j.rls !== 'object' || !Object.keys(j.rls).length)) bad.push(`${f}: no RLS rules ("rls" missing)`);
  }
  if (bad.length) return rec(`entities (${files.length})`, 'fail', bad.join('\n'));
  rec(`entities (${files.length}): parse + RLS present`, 'pass');
}

// ---------- 5. secret scan ----------
const SECRET_PATTERNS = [
  ['Stripe secret/restricted key', /\b[sr]k_(live|test)_[0-9a-zA-Z]{16,}/],
  ['Stripe webhook secret', /\bwhsec_[0-9a-zA-Z]{20,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Private key block', /-----BEGIN ([A-Z]+ )?PRIVATE KEY-----/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI key', /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['SendGrid key', /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}/],
  ['Resend key', /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/],
  ['api_key in URL', /[?&](api_?key|apikey|access_token|key)=[A-Za-z0-9_-]{20,}/i],
  ['Hard-coded credential', /\b(api[_-]?key|secret[_-]?key|client[_-]?secret|password|auth[_-]?token)\b["']?\s*[:=]\s*["'](?=[^"']*\d)(?=[^"']*[A-Za-z])[A-Za-z0-9_\-+/=]{24,}["']/i],
];
const WARN_PATTERNS = [['Google API key (ok only if browser-restricted)', /\bAIza[0-9A-Za-z_-]{35}\b/]];
function checkSecrets() {
  const targets = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'base44')), ...walk(path.join(ROOT, 'public')), path.join(ROOT, 'index.html'), ...walk(path.join(ROOT, 'dist'), [], new Set())]
    .filter((f) => fs.existsSync(f) && /\.(m?[jt]sx?|cjs|json|jsonc|html|css|md|txt|xml|env|ya?ml)$/.test(f));
  const hits = [];
  const warns = [];
  for (const f of targets) {
    if (fs.statSync(f).size > 20 << 20) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('release-check:allow')) return;
      for (const [name, re] of SECRET_PATTERNS) if (re.test(line)) hits.push(`${rel(f)}:${i + 1} ${name}`);
      for (const [name, re] of WARN_PATTERNS) if (re.test(line)) warns.push(`${rel(f)}:${i + 1} ${name}`);
    });
  }
  if (hits.length) return rec('secret scan', 'fail', [...new Set(hits)].slice(0, 30).join('\n') + '\n(values not printed)');
  rec('secret scan', warns.length ? 'warn' : 'pass', warns.length ? [...new Set(warns)].slice(0, 10).join('\n') : `${targets.length} files scanned`);
}

// ---------- 6. dist hygiene ----------
function checkDist() {
  if (!exists('dist/index.html')) return rec('dist hygiene', 'fail', 'dist/index.html missing (build failed?)');
  const files = walk(path.join(ROOT, 'dist'), [], new Set());
  const maps = files.filter((f) => f.endsWith('.map'));
  const mapRefs = files.filter((f) => /\.(js|css)$/.test(f) && /sourceMappingURL=/.test(fs.readFileSync(f, 'utf8').slice(-400)));
  rec('no source maps in dist', maps.length || mapRefs.length ? 'fail' : 'pass', [...maps, ...mapRefs].map(rel).slice(0, 10).join('\n'));
  const gf = files.filter((f) => /\.(html|css|js)$/.test(f) && /fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(f, 'utf8'))).map(rel);
  rec('no Google Fonts requests (self-hosted fonts)', gf.length ? (CFG.failOnGoogleFonts ? 'fail' : 'warn') : 'pass', gf.length ? `referenced in: ${gf.join(', ')}` : '');
  const html = read('dist/index.html');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim();
  const desc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(html) || /<meta[^>]+content=["'][^"']{10,}["'][^>]+name=["']description["']/i.test(html);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const metaProblems = [];
  if (!title) metaProblems.push('missing <title>');
  if (!viewport) metaProblems.push('missing viewport meta');
  if (!desc) metaProblems.push('missing meta description');
  const hard = !title || !viewport || (CFG.kind === 'website' && !desc);
  rec('index.html title/meta', metaProblems.length ? (hard ? 'fail' : 'warn') : 'pass', metaProblems.length ? metaProblems.join(', ') : `title: "${title}"`);
}

// ---------- 7. perf budget ----------
function entryChunk() {
  const html = read('dist/index.html');
  const m = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/i) || html.match(/<script[^>]+src=["']([^"']+\.js)["'][^>]*type=["']module["']/i);
  if (!m) return null;
  const p = path.join(ROOT, 'dist', m[1].replace(/^\//, '').replace(/^\.\//, ''));
  return fs.existsSync(p) ? p : null;
}
function checkPerf() {
  if (!exists('dist/index.html')) return rec('perf budget', 'fail', 'no dist');
  const p = entryChunk();
  if (!p) return rec('perf budget: main JS chunk', 'warn', 'could not locate entry chunk');
  const buf = fs.readFileSync(p);
  const kb = Math.round(buf.length / 1024);
  const gz = Math.round(zlib.gzipSync(buf).length / 1024);
  const budget = CFG.mainJsBudgetKB;
  const detail = `${rel(p)}: ${kb} KB raw / ${gz} KB gzip; budget ${budget ?? 'not set'} KB`;
  rec('perf budget: main JS chunk', budget && kb > budget ? 'fail' : budget ? 'pass' : 'warn', detail);
  const big = walk(path.join(ROOT, 'public'), [], new Set(['node_modules']))
    .filter((f) => /\.(png|jpe?g|gif|webp|avif|svg|bmp|tiff?)$/i.test(f) && fs.statSync(f).size > CFG.imageWarnKB * 1024)
    .map((f) => `${rel(f)} (${Math.round(fs.statSync(f).size / 1024)} KB)`);
  rec(`images in public/ <= ${CFG.imageWarnKB} KB`, big.length ? 'warn' : 'pass', big.join('\n'));
}

// ---------- 8. route smoke (vite preview) ----------
function routes() {
  const set = new Set(['/']);
  const add = (r) => {
    if (!r || !r.startsWith('/') || r.includes('*') || CFG.skipRoutes.includes(r)) return;
    set.add(r.replace(/:[A-Za-z_]+\??/g, 'release-check-test'));
  };
  for (const f of ['src/App.jsx', 'src/App.tsx', 'src/App.js', 'src/routes.jsx', 'src/routes.js']) {
    if (!exists(f)) continue;
    const s = read(f);
    for (const m of s.matchAll(/path=\{?\s*["'`]([^"'`]+)["'`]/g)) add(m[1]);
    for (const m of s.matchAll(/\bpath:\s*["'`](\/[^"'`]*)["'`]/g)) add(m[1]);
  }
  for (const f of ['src/App.jsx', 'src/App.tsx']) {
    if (exists(f)) for (const m of read(f).matchAll(/\[\s*["'`](\/[^"'`]*)["'`]\s*,/g)) add(m[1]);
  }
  if (exists('public/sitemap.xml')) {
    for (const m of read('public/sitemap.xml').matchAll(/<loc>\s*https?:\/\/[^/<]+(\/[^<\s]*)?\s*<\/loc>/g)) add(m[1] || '/');
  }
  if (exists('src/pages.config.js')) {
    const s = read('src/pages.config.js');
    const block = (s.match(/PAGES\s*=\s*\{([\s\S]*?)\}/) || [])[1] || '';
    for (const m of block.matchAll(/^\s*["']?([A-Za-z0-9_-]+)["']?\s*:/gm)) add('/' + m[1]);
  }
  CFG.extraRoutes.forEach(add);
  return [...set];
}
function run(cmd, args, timeout) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { cwd: ROOT });
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (out += d));
    const t = setTimeout(() => { c.kill('SIGKILL'); resolve({ code: -1, out, timedOut: true }); }, timeout);
    c.on('close', (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}
async function waitUp(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
async function checkRoutes() {
  if (!exists('dist/index.html')) return rec('route smoke', 'fail', 'no dist');
  const port = CFG.previewPort;
  const base = `http://127.0.0.1:${port}`;
  const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', detached: true });
  try {
    if (!(await waitUp(base + '/', 45000))) return rec('route smoke (vite preview)', 'fail', 'vite preview did not start');
    const indexHtml = await (await fetch(base + '/')).text();
    const assets = [...indexHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((m) => m[1]);
    const bad = [];
    for (const a of assets) { const r = await fetch(base + a); if (r.status !== 200) bad.push(`asset ${a} -> ${r.status}`); }
    const list = routes();
    for (const r of list) {
      const res = await fetch(base + r, { headers: { accept: 'text/html' } });
      const body = await res.text();
      if (res.status !== 200) bad.push(`${r} -> HTTP ${res.status}`);
      else if (!/id=["']root["']|<div id=root/.test(body)) bad.push(`${r} -> 200 but no #root mount node`);
      else if (!/<title>[^<]+<\/title>/i.test(body)) bad.push(`${r} -> no <title>`);
    }
    for (const f of ['robots.txt', 'sitemap.xml']) {
      if (exists('public/' + f)) { const res = await fetch(`${base}/${f}`); if (res.status !== 200) bad.push(`/${f} -> ${res.status}`); }
    }
    rec(`route smoke (${list.length} routes, ${assets.length} assets via vite preview)`, bad.length ? 'fail' : 'pass', bad.join('\n'));
    await browserSmoke(base);
  } finally {
    try { process.kill(-srv.pid, 'SIGKILL'); } catch { try { srv.kill('SIGKILL'); } catch { /* gone */ } }
  }
}

// ---------- 9. headless browser smoke (Playwright, provisioned on demand in /tmp) ----------
// Default: on for kind 'website', off for logged-in apps (they only render the Base44 login).
async function loadPlaywright() {
  const dir = path.join(os.tmpdir(), 'release-check-pw');
  const mod = path.join(dir, 'node_modules', 'playwright-core', 'index.mjs');
  const sh = (cmd, args, t = 300000) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', timeout: t, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(dir, 'browsers') } });
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(dir, 'browsers');
  if (!fs.existsSync(mod)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"rc-pw","private":true}');
    if (sh('npm', ['i', '--no-audit', '--no-fund', 'playwright-core@1.49.1']).status !== 0) throw new Error('npm install playwright-core failed');
  }
  if (!fs.existsSync(path.join(dir, 'browsers')) || !fs.readdirSync(path.join(dir, 'browsers')).some((d) => d.startsWith('chromium_headless_shell'))) {
    if (sh('npx', ['playwright-core', 'install', 'chromium-headless-shell']).status !== 0) throw new Error('chromium download failed');
  }
  const { chromium } = await import(mod);
  try { await (await chromium.launch()).close(); } catch {
    spawnSync('apt-get', ['update'], { timeout: 200000 });
    if (sh('npx', ['playwright-core', 'install-deps', 'chromium-headless-shell'], 400000).status !== 0) throw new Error('system libraries for chromium could not be installed');
  }
  return chromium;
}
async function browserSmoke(base) {
  const on = CFG.browserSmoke ?? CFG.kind === 'website';
  if (!on || ARGS.has('--fast') || process.env.RELEASE_SKIP_BROWSER) return rec('browser smoke (Playwright)', 'skip', on ? 'disabled (--fast)' : 'not enabled for this app (login-gated pages)');
  let chromium;
  const t = Date.now();
  try { chromium = await loadPlaywright(); } catch (e) { return rec('browser smoke (Playwright)', 'warn', `could not provision headless Chromium: ${e.message}`); }
  const pages = CFG.browserPages || routes().filter((r) => !r.includes('release-check-test')).slice(0, 3);
  const browser = await chromium.launch();
  const bad = [];
  const notes = [];
  try {
    for (const p of pages) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
      const res = await page.goto(base + p, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => ({
        rootKids: document.getElementById('root')?.children.length || 0,
        text: (document.body?.innerText || '').trim().length,
        h1: document.querySelectorAll('h1').length,
        hScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
        title: document.title,
      }));
      if (!res || res.status() !== 200) bad.push(`${p}: HTTP ${res && res.status()}`);
      if (errors.length) bad.push(`${p}: uncaught JS error: ${errors[0]}`);
      if (!info.rootKids || info.text < 40) bad.push(`${p}: page rendered blank (${info.text} chars of text)`);
      if (CFG.kind === 'website' && !info.h1) notes.push(`${p}: no <h1>`);
      if (info.hScroll) notes.push(`${p}: horizontal scroll at 390px width`);
      await page.close();
    }
  } finally { await browser.close(); }
  rec(`browser smoke (Playwright, ${pages.length} pages, ${((Date.now() - t) / 1000).toFixed(0)}s)`, bad.length ? 'fail' : notes.length ? 'warn' : 'pass', [...bad, ...notes].join('\n'));
}

// ---------- main ----------
const t0 = Date.now();
checkBuild();
const buildOk = results[0].status !== 'fail';
checkLint();
await checkFunctions();
checkEntities();
checkSecrets();
if (buildOk) {
  checkDist();
  checkPerf();
  await checkRoutes();
} else rec('dist/perf/route checks', 'fail', 'skipped because the build failed');

const fails = results.filter((r) => r.status === 'fail');
const warns = results.filter((r) => r.status === 'warn');
console.log(`\n==== release-check: ${results.length - fails.length - warns.length} pass, ${warns.length} warn, ${fails.length} fail (${((Date.now() - t0) / 1000).toFixed(0)}s) ====`);
for (const r of results) console.log(`  ${r.status.toUpperCase().padEnd(4)}  ${r.name}`);
process.exit(fails.length ? 1 : 0);
