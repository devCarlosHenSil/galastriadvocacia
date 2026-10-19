#!/usr/bin/env node
/**
 * The audit of the dependencies, with the **accepted advisories pinned by
 * their ID** (SEC-R-11).
 *
 *   node scripts/check-audit.mjs [audit.json]
 *
 * The exception of the `astro` is documented in `docs/security-decisions.md`:
 * the 10 advisories below are the accepted ones. Any **other** advisory of
 * high or critical severity — of any package — makes the check fail, and so
 * does an advisory of the `astro` that is not on the list.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUDIT_FILE = resolve(process.cwd(), process.argv[2] ?? 'audit.json');
const DECISIONS = resolve(process.cwd(), 'docs/security-decisions.md');

/**
 * The advisories that are accepted, per package. The list has to match the
 * one of `docs/security-decisions.md` — the check verifies it.
 */
export const ACCEPTED = {
  astro: [
    'GHSA-j687-52p2-xcff',
    'GHSA-xr5h-phrj-8vxv',
    'GHSA-jrpj-wcv7-9fh9',
    'GHSA-f48w-9m4c-m7f5',
    'GHSA-7pw4-f3q4-r2p2',
    'GHSA-4g3v-8h47-v7g6',
    'GHSA-2pvr-wf23-7pc7',
    'GHSA-8hv8-536x-4wqp',
    'GHSA-26w7-cxv4-gfx2',
    'GHSA-376h-93r7-7g6f',
  ],
};

const problems = [];

/**
 * @param {string} advisory the URL of the advisory
 * @returns {string | null} the GHSA id
 */
function advisoryId(advisory) {
  const match = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/.exec(String(advisory));
  return match ? match[0] : null;
}

let audit;
try {
  audit = JSON.parse(readFileSync(AUDIT_FILE, 'utf8'));
} catch (error) {
  console.error(`check-audit: could not read ${AUDIT_FILE} (${error.message}).`);
  console.error('check-audit: run `npm audit --audit-level=high --json > audit.json` first.');
  process.exit(1);
}

const decisions = readFileSync(DECISIONS, 'utf8');
for (const [packageName, ids] of Object.entries(ACCEPTED)) {
  for (const id of ids) {
    if (!decisions.includes(id)) {
      problems.push(`${id}: the accepted advisory is not documented in docs/security-decisions.md`);
    }
  }
  if (!decisions.includes(`${ids.length} advisor`)) {
    problems.push(`the count of the accepted advisories of ${packageName} (${ids.length}) is not documented`);
  }
}

let checked = 0;
for (const [name, vulnerability] of Object.entries(audit.vulnerabilities ?? {})) {
  if (vulnerability.severity !== 'high' && vulnerability.severity !== 'critical') continue;
  checked++;
  const accepted = ACCEPTED[name];
  if (!accepted) {
    problems.push(`${name}: ${vulnerability.severity} — no accepted exception`);
    continue;
  }
  const ids = (vulnerability.via ?? [])
    .map((entry) => (typeof entry === 'string' ? null : advisoryId(entry.url)))
    .filter(Boolean);
  const unknown = ids.filter((id) => !accepted.includes(id));
  if (unknown.length > 0) {
    problems.push(`${name}: the advisory(ies) ${unknown.join(', ')} are not on the accepted list`);
  }
  if (ids.length > accepted.length) {
    problems.push(`${name}: ${ids.length} advisories, the accepted list has ${accepted.length}`);
  }
  const missing = accepted.filter((id) => !ids.includes(id));
  if (missing.length > 0) {
    // Not an error: the accepted list may be wider than what npm currently
    // reports. It is reported so that the list can be pruned.
    console.log(`check-audit: note — ${name}: the accepted list mentions ${missing.join(', ')}, which npm does not report.`);
  }
}

if (problems.length > 0) {
  console.error(`check-audit: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `check-audit: ${checked} package(s) with high/critical severity, only the accepted advisories of ` +
    `docs/security-decisions.md (astro: ${ACCEPTED.astro.length}).`,
);
