/**
 * Verification of the CI workflow against SPEC-SECURITY SEC-50…SEC-55.
 * Run: node scripts/verify-workflow.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const YAML = require('yaml');

const file = '.github/workflows/deploy.yml';
const text = readFileSync(file, 'utf8');
const doc = YAML.parse(text);

const problems = [];
const ok = [];

/**
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
function check(label, condition, detail = '') {
  if (condition) ok.push(`${label}${detail ? ' — ' + detail : ''}`);
  else problems.push(`${label}${detail ? ' — ' + detail : ''}`);
}

// --- SEC-51: the triggers ----------------------------------------------------
const on = doc.on ?? doc[true];
check('SEC-51 · push em main', JSON.stringify(on?.push) === JSON.stringify({ branches: ['main'] }), JSON.stringify(on?.push));
check('SEC-51 · workflow_dispatch', 'workflow_dispatch' in on);
check('SEC-51 · pull_request AUSENTE', !('pull_request' in on));

// --- SEC-52: least privilege ------------------------------------------------
check('SEC-52 · permissions topo = contents: read', doc.permissions?.contents === 'read' && Object.keys(doc.permissions ?? {}).length === 1, JSON.stringify(doc.permissions));
const build = doc.jobs?.build;
const deploy = doc.jobs?.deploy;
check(
  'SEC-52 · build job (SEC-R-07: só contents: read — sem pages: write)',
  build?.permissions?.contents === 'read' && Object.keys(build?.permissions ?? {}).length === 1,
  JSON.stringify(build?.permissions),
);
check(
  'SEC-52 · deploy job (contents: read + pages: write + id-token: write)',
  deploy?.permissions?.contents === 'read' &&
    deploy?.permissions?.pages === 'write' &&
    deploy?.permissions?.['id-token'] === 'write' &&
    Object.keys(deploy?.permissions ?? {}).length === 3,
  JSON.stringify(deploy?.permissions),
);
const allPerms = JSON.stringify(doc);
check('SEC-52 · sem contents: write / write-all', !/contents:\s*write|write-all/.test(allPerms));

// --- SEC-R-07: the build job cannot publish ---------------------------------
check('SEC-R-07 · o build job não tem pages: write', !('pages' in (build?.permissions ?? {})));
check('SEC-R-07 · o build job não tem id-token: write', !('id-token' in (build?.permissions ?? {})));
check('SEC-R-07 · timeout-minutes no build', typeof build?.['timeout-minutes'] === 'number', String(build?.['timeout-minutes']));
check('SEC-R-07 · timeout-minutes no deploy', typeof deploy?.['timeout-minutes'] === 'number', String(deploy?.['timeout-minutes']));

// --- SEC-53: no PAT ---------------------------------------------------------
check('SEC-53 · nenhum PAT', !/secrets\.[A-Z_]*(PAT|TOKEN|KEY)/.test(text));

// --- SEC-54: persist-credentials --------------------------------------------
const checkout = (build?.steps ?? []).find((s) => s.uses?.startsWith('actions/checkout'));
check('SEC-54 · persist-credentials: false', checkout?.with?.['persist-credentials'] === false);

// --- SEC-50: the 5 actions pinned by SHA ------------------------------------
const EXPECTED = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
  'actions/configure-pages': '45bfe0192ca1faeb007ade9deae92b16b8254a0d',
  'actions/upload-pages-artifact': 'fc324d3547104276b827a68afc52ff2a11cc49c9',
  'actions/deploy-pages': '368f82528645a54fb793d4d04e342629a3f51346',
};
const steps = [...(build?.steps ?? []), ...(deploy?.steps ?? [])];
const used = steps.filter((s) => s.uses).map((s) => s.uses);
for (const [action, sha] of Object.entries(EXPECTED)) {
  const found = used.find((u) => u.startsWith(`${action}@`));
  check(`SEC-50 · ${action}`, found === `${action}@${sha}`, found ?? 'ausente');
}
check('SEC-50 · nenhuma action por tag', !used.some((u) => /@(v[0-9]|main|master|latest)/.test(u)), used.join(', '));

// --- SEC-55: the guard and the build ----------------------------------------
const runs = steps.filter((s) => s.run).map((s) => s.run);
const guardIndex = runs.findIndex((r) => r.includes('guard-secrets.mjs'));
const buildIndex = runs.findIndex((r) => r.includes('npm run build'));
check('SEC-55 · step explícito da guarda', guardIndex !== -1);
check('SEC-55 · a guarda corre ANTES do build', guardIndex !== -1 && buildIndex !== -1 && guardIndex < buildIndex);
check('SEC-55 · npm ci (não npm install)', runs.some((r) => /npm ci\b/.test(r)) && !runs.some((r) => /npm install\b/.test(r)));
const buildStep = steps.find((s) => s.run?.includes('npm run build'));
check('SEC-55 · env SITE_BASE=/', buildStep?.env?.SITE_BASE === '/');
check('SEC-55 · env PUBLIC_FORMSPREE_ENDPOINT (vars, não secrets)', buildStep?.env?.PUBLIC_FORMSPREE_ENDPOINT === '${{ vars.PUBLIC_FORMSPREE_ENDPOINT }}');

// --- concurrency + environment ----------------------------------------------
check('SEC-51 · concurrency pages / cancel-in-progress', doc.concurrency?.group === 'pages' && doc.concurrency?.['cancel-in-progress'] === true);
check('SEC-52 · environment github-pages', deploy?.environment?.name === 'github-pages' && deploy?.environment?.url === '${{ steps.deployment.outputs.page_url }}');
check('SEC-49 · node-version 20 + cache npm', (build?.steps ?? []).some((s) => s.with?.['node-version'] === 20 && s.with?.cache === 'npm'));

// --- SEC-R-11: the audit exception is pinned by the advisory ID --------------
const auditStep = (build?.steps ?? []).find((s) => s.run?.includes('check-audit.mjs'));
check('SEC-R-11 · o audit usa scripts/check-audit.mjs', Boolean(auditStep));
check('SEC-R-11 · o audit não tolera um pacote inteiro', !runs.some((r) => r.includes("k!=='astro'")));

// --- SEC-R-09: the rotation gate blocks the publication ----------------------
const deployRuns = (deploy?.steps ?? []).filter((s) => s.run).map((s) => s.run);
const buildRuns = (build?.steps ?? []).filter((s) => s.run).map((s) => s.run);
check('SEC-R-09 · o gate da rotação corre no job de publicação', deployRuns.some((r) => r.includes('check-rotation-gate.mjs')));
check(
  'SEC-R-09 · o gate da rotação NÃO corre no job de build',
  !buildRuns.some((r) => r.includes('check-rotation-gate.mjs')),
);

// --- D10: o `configure-pages` precisa de `pages: read` ------------------
// No job de build (que só tem `contents: read`) a ação devolvia 403 e
// **nada era publicado** — e o erro lia-se como uma falha do CI, não como
// um problema de permissões.
const buildConfigure = (build?.steps ?? []).find((s) => s.uses?.startsWith('actions/configure-pages'));
const deployConfigure = (deploy?.steps ?? []).find((s) => s.uses?.startsWith('actions/configure-pages'));
check('D10 · o configure-pages está no job de publicação', Boolean(deployConfigure), deployConfigure?.uses ?? 'ausente');
check('D10 · o configure-pages NÃO está no job de build', !buildConfigure);
check('D10 · o job de build continua sem pages: write', !('pages' in (build?.permissions ?? {})));

// --- C2: the deploy job can actually publish --------------------------------
// The rotation gate reads `scripts/` and `docs/rotation-gate.md` from the
// working directory: without a checkout the step fails with "file not found"
// and the site is never published — the gate would block for the wrong
// reason (and a hard gate that always fails is a hard gate that gets
// deleted).
const deployCheckout = (deploy?.steps ?? []).find((s) => s.uses?.startsWith('actions/checkout'));
check('C2 · o job de publicação tem checkout', Boolean(deployCheckout), deployCheckout?.uses ?? 'ausente');
check('C2 · o checkout da publicação tem persist-credentials: false', deployCheckout?.with?.['persist-credentials'] === false);
check('C2 · o checkout da publicação é o primeiro step', (deploy?.steps ?? [])[0]?.uses?.startsWith('actions/checkout'));
check('C2 · o job de publicação tem contents: read', deploy?.permissions?.contents === 'read');

// --- C16: as verificações correm no CI --------------------------------------
for (const script of [
  'verify-workflow.mjs',
  'check-audit.mjs',
  'guard-secrets.mjs',
  'npm run check',
  'npm run build',
  'verify-csp.mjs',
  'check-parity.mjs',
  'check-links.mjs',
  'check-contrast.mjs',
  'check-redirects.mjs',
  'guard-self-test.mjs',
  'check-dist.mjs',
]) {
  check(`C16 · o CI corre ${script}`, buildRuns.some((run) => run.includes(script)));
}

// --- REV-2: o `verify-workflow` só pode correr DEPOIS do `npm ci` ------------
// O script usa o pacote `yaml` (uma devDependency): num runner limpo não há
// `node_modules` antes do `npm ci` e o step morria com MODULE_NOT_FOUND — o
// pipeline nunca tinha corrido.
const ciIndex = buildRuns.findIndex((run) => run.includes('npm ci'));
const verifyIndex = buildRuns.findIndex((run) => run.includes('verify-workflow.mjs'));
const buildStepIndex = buildRuns.findIndex((run) => run.includes('npm run build'));
check(
  'REV-2 · o npm ci corre antes do verify-workflow',
  ciIndex !== -1 && verifyIndex !== -1 && ciIndex < verifyIndex,
  `npm ci em ${ciIndex}, verify-workflow em ${verifyIndex}`,
);
check('REV-2 · o verify-workflow corre antes do build', verifyIndex !== -1 && buildStepIndex > verifyIndex);
check('REV-7 · a verificação de tipos (npm run check) corre no CI', buildRuns.some((run) => run.includes('npm run check')));
check(
  'C16 · o artefacto é carregado depois das verificações',
  (build?.steps ?? []).findIndex((s) => s.uses?.startsWith('actions/upload-pages-artifact')) >
    (build?.steps ?? []).findIndex((s) => s.run?.includes('check-dist.mjs')),
);

// --- the CNAME is inside the artifact (R18) ---------------------------------
check('R18 · public/CNAME dentro do artefato', readFileSync('public/CNAME', 'utf8').trim() === 'galastriadvocacia.com.br');

console.log(`workflow ${file}: ${ok.length} verificação(ões) OK`);
for (const line of ok) console.log(`  ok   ${line}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problema(s):`);
  for (const line of problems) console.error(`  FALHA ${line}`);
  process.exit(1);
}
