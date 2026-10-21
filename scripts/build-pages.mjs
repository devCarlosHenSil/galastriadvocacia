#!/usr/bin/env node
/**
 * The build of the Cloudflare Pages (D86, SEC-67, D88).
 *
 * The Cloudflare Pages builds the repository (Git integration) with this
 * script as the **build command**:
 *
 *   node scripts/build-pages.mjs
 *
 * It does three things, in this order:
 *
 * 1. the guard of secrets (SEC-30) — a build with a secret in it is a build
 *    that must not exist;
 * 2. the build (`astro build`) — the output is `dist/`, the output directory
 *    of the Pages project;
 * 3. the **gate of the rotation of the secrets** (SEC-67) — the publication
 *    stops while the 12 rotations of `docs/rotation-gate.md` are pending.
 *
 * ## The gate and the override (D88)
 *
 * The gate runs by default (`ROTATION_GATE=enforce`). The owner authorised an
 * **explicit override** — `ROTATION_GATE=skip` — that publishes before the 12
 * rotations are done (the site has been offline for months). The override:
 *
 * - only applies to a **Cloudflare build** (`CF_PAGES_BRANCH` is set) — a
 *   local run never uses it, and the gate runs locally;
 * - prints a **loud** warning (the residual risk is accepted, not hidden);
 * - is **reversible**: unset the variable in the Pages Production environment
 *   and the next build fails again.
 *
 * The decision and its residual risk: `docs/security-decisions.md` (D88).
 */
import { spawnSync } from 'node:child_process';

/**
 * The branch that publishes (the Cloudflare Pages "production branch").
 *
 * ⚠️ **No silent default** (SEC-N-09): if this variable is missing, the build
 * **aborts**. A default of `main` would skip the rotation gate whenever the
 * production branch was another one — and the site would publish with the
 * backup credentials still valid. The invariant I3 is a hard gate: it either
 * runs, or the build fails.
 */
const PRODUCTION_BRANCH = (process.env.PRODUCTION_BRANCH ?? '').trim();

/** The branch that Cloudflare is building (`CF_PAGES_BRANCH`). */
const BRANCH = (process.env.CF_PAGES_BRANCH ?? '').trim();

/**
 * The rotation gate (SEC-67).
 *
 * The default is **`enforce`**: the gate runs and the publication stops while
 * the 12 rotations are pending. The value `skip` is the **explicit override
 * the owner authorised** (D88 — `docs/security-decisions.md`): it only applies
 * to a **Cloudflare build** (`CF_PAGES_BRANCH` is set), it prints a loud
 * warning, and **a local run never uses it** — the gate runs locally too, so
 * nobody is surprised by a publication that the gate would have stopped.
 */
const ROTATION_GATE = (process.env.ROTATION_GATE ?? 'enforce').trim().toLowerCase();

/**
 * Runs a command and stops the script when it fails.
 *
 * @param {string} label what the log says
 * @param {string[]} command the command and its arguments
 */
function run(label, command) {
  console.log(`\n[build-pages] ${label}`);
  const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
  if (result.error) {
    console.error(`[build-pages] ${label} could not run: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[build-pages] ${label} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

// 0. The production branch has to be declared. A **preview** (any branch
//    that is not the production one) skips the gate — a preview is not a
//    publication — but the build has to know which one is the production
//    branch. Without it the build ABORTS: a silent default would publish
//    with the backup credentials still valid (SEC-N-09).
if (BRANCH !== '' && PRODUCTION_BRANCH === '') {
  console.error(
    '[build-pages] PRODUCTION_BRANCH is not set — the build is ABORTED.\n' +
      '  The rotation gate (SEC-67) decides what publishes; without knowing the\n' +
      '  production branch the build cannot tell a publication from a preview,\n' +
      '  and a silent default would publish with the backup credentials still\n' +
      '  valid. Set PRODUCTION_BRANCH in the project (Cloudflare Pages →\n' +
      '  Settings → Environment variables → Production).',
  );
  process.exit(1);
}

// 1. The guard (SEC-30) — the same check that the `prebuild` of `npm run build`
//    runs, but explicit: here the build command **is** this script.
run('a guarda de segredos (SEC-30)', [process.execPath, 'scripts/guard-secrets.mjs']);

// 2. The build — the output is `dist/` (the output directory of the Pages
//    project).
run('o build (astro build)', [process.execPath, 'node_modules/astro/astro.js', 'build']);

// 3. The gate of the rotation (SEC-67).
//
//    - **production** → the gate runs (or the explicit D88 override, loudly);
//    - **preview** (another branch) → skipped: a preview is not a publication;
//    - **local** (no CF_PAGES_BRANCH) → the gate RUNS: the override never
//      applies outside a Cloudflare build, and a local build that "publishes"
//      nothing still has to face the gate.
const isCloudflareBuild = BRANCH !== '';
const isProduction = isCloudflareBuild && BRANCH === PRODUCTION_BRANCH;

if (isProduction && ROTATION_GATE === 'skip') {
  // D88 — the owner's explicit decision. The gate **does not** run: the
  // publication happens with the 12 rotations still pending. The warning is
  // deliberately impossible to miss.
  console.warn(
    '\n[build-pages] ATENÇÃO: o gate da rotação foi SALTADO por decisão explícita (ROTATION_GATE=skip, D88).',
  );
  console.warn(
    '[build-pages] As 12 rotações de docs/rotation-gate.md CONTINUAM por fazer. Risco residual aceite pelo dono.',
  );
  console.warn(
    '[build-pages] Para voltar a bloquear a publicação: tirar a variável ROTATION_GATE do ambiente de Production.',
  );
} else if (isCloudflareBuild && !isProduction) {
  console.log(
    `\n[build-pages] "${BRANCH}" is not the production branch ("${PRODUCTION_BRANCH}") — ` +
      'the rotation gate is SKIPPED (a preview is not a publication).',
  );
} else {
  run('o gate da rotação dos segredos (SEC-67)', [process.execPath, 'scripts/check-rotation-gate.mjs']);
}

console.log('\n[build-pages] done.');
