/**
 * Verification of the CI workflow against SPEC-SECURITY SEC-50…SEC-55.
 * Run: node scripts/verify-workflow.mjs
 *
 * D86 — the workflow **does not publish**: the Cloudflare Pages does (and
 * its build passes the gate of the rotation, in `scripts/build-pages.mjs`).
 * The assertions below prove that there is **no** publishing capability left
 * in the workflow.
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
// SEC-N-10 — a branch que **publica** (a production branch do projecto da
// Cloudflare Pages) tem de estar nos gatilhos: sem ela, nenhum check corre
// no código que é publicado.
const PUBLISHING_BRANCH = 'feat/cloudflare-pages-worker';
check(
  'SEC-51 · push em main',
  Array.isArray(on?.push?.branches) && on.push.branches.includes('main'),
  JSON.stringify(on?.push?.branches),
);
check('SEC-51 · workflow_dispatch', 'workflow_dispatch' in on);
// F1: o `pull_request` **existe** — é o gatilho que só verifica. Sem ele, a
// branch protection (que exige o status check `build`) nunca via um check
// num PR e a aprovação era impossível.
check('F1 · o gatilho pull_request existe', 'pull_request' in on, JSON.stringify(on?.pull_request));
check(
  'SEC-N-10 · o push corre na branch que publica',
  Array.isArray(on?.push?.branches) && on.push.branches.includes(PUBLISHING_BRANCH),
  JSON.stringify(on?.push?.branches),
);
check(
  'SEC-N-10 · o pull request corre na branch que publica',
  Array.isArray(on?.pull_request?.branches) && on.pull_request.branches.includes(PUBLISHING_BRANCH),
  JSON.stringify(on?.pull_request?.branches),
);

// --- the job that runs the verification ---------------------------------------
const build = doc.jobs?.build;
const buildSteps = build?.steps ?? [];
const buildRuns = buildSteps.filter((s) => s.run).map((s) => s.run);
const used = buildSteps.filter((s) => s.uses).map((s) => s.uses);

// --- SEC-50: the 2 actions pinned by SHA ------------------------------------
const EXPECTED = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
};

// --- D3: o job `functions` (a fase de comportamento da Function) -------------
const functions = doc.jobs?.functions;
const functionsSteps = functions?.steps ?? [];
const functionsRuns = functionsSteps.filter((s) => s.run).map((s) => s.run);
const functionsUsed = functionsSteps.filter((s) => s.uses).map((s) => s.uses);

check('D3 · o job `functions` existe', Boolean(functions));
check(
  'D3 · o job `functions` só tem contents: read',
  functions?.permissions?.contents === 'read' && Object.keys(functions?.permissions ?? {}).length === 1,
  JSON.stringify(functions?.permissions),
);
check(
  'D3 · o job `functions` corre no Node 22 (a fase de comportamento precisa de ≥ 22.6)',
  functionsSteps.some((s) => s.with?.['node-version'] === 22),
);
check('D3 · o job `functions` faz npm ci', functionsRuns.some((r) => /npm ci\b/.test(r)));
check('D3 · o job `functions` constrói o site', functionsRuns.some((r) => r.includes('npm run build')));
check(
  'D3 · o job `functions` corre a verificação da Function',
  functionsRuns.some((r) => r.trim() === 'npm run check:function'),
);
check(
  'D3 · o job `functions` não publica nada',
  functionsUsed.every((u) => !/pages/i.test(u)) && !/pages:\s*write/.test(JSON.stringify(functions)),
);
check(
  'D3 · as actions do job `functions` são as mesmas (fixadas por SHA)',
  functionsUsed.every((u) => Object.values(EXPECTED).some((sha) => u.endsWith(sha))),
  functionsUsed.join(', '),
);
const functionsCi = functionsRuns.findIndex((r) => /npm ci\b/.test(r));
const functionsCheck = functionsRuns.findIndex((r) => r.trim() === 'npm run check:function');
check(
  'D3 · no job `functions` o npm ci corre antes da verificação',
  functionsCi !== -1 && functionsCheck !== -1 && functionsCi < functionsCheck,
);
check(
  'D3 · no job `build` a verificação da Function corre depois de npm run check e antes do build',
  buildRuns.indexOf('npm run check:function') >
    buildRuns.findIndex((r) => r.trim() === 'npm run check') &&
    buildRuns.indexOf('npm run check:function') < buildRuns.findIndex((r) => r.includes('npm run build')),
);
// REV-06 / REV-07 — a lógica da publicação é testada (o build command da
// Cloudflare Pages decide o que se publica: o gate e o fail-closed).
check(
  'REV-6 · o job `build` exercita a lógica da publicação (o build command)',
  buildRuns.some((r) => r.includes('check-build-pages.mjs')),
  buildRuns.join(' | '),
);

// --- D86: the workflow does NOT publish ---------------------------------------
// A publicação é da Cloudflare Pages. O workflow não tem **nenhuma**
// capacidade de publicar: sem as actions do Pages, sem `pages: write`, sem
// `id-token: write` e sem o `environment` do GitHub Pages.
check('D86 · não há job de publicação', !doc.jobs?.deploy, Object.keys(doc.jobs ?? {}).join(', '));
check(
  'D86 · o workflow não usa nenhuma action de publicação',
  used.every((u) => !/upload-pages-artifact|configure-pages|deploy-pages/.test(u)),
  used.join(', '),
);
check('D86 · o workflow não tem pages: write', !/"pages":\s*"write"/.test(JSON.stringify(doc)));
check('D86 · o workflow não tem id-token: write', !/"id-token":\s*"write"/.test(JSON.stringify(doc)));
check('D86 · o workflow não tem o environment github-pages', !text.includes('github-pages'));
check('D86 · nenhuma action de publicação', used.every((u) => !/pages/i.test(u)), used.join(', '));

// --- D86: the gate of the rotation is in the build of the Cloudflare ---------
// SEC-67 — o gate mudou de sítio: bloqueia o **build de produção** da
// Cloudflare Pages, não um job do GitHub. As pre-visualizações não são
// bloqueadas.
check('D86 · o gate da rotação NÃO corre no CI', !buildRuns.some((r) => r.includes('check-rotation-gate.mjs')));
const buildPages = readFileSync('scripts/build-pages.mjs', 'utf8');
check('D86 · o build da Cloudflare corre o gate da rotação', buildPages.includes('check-rotation-gate.mjs'));
check(
  'D86 · o build da Cloudflare só corre o gate na branch de produção',
  buildPages.includes('CF_PAGES_BRANCH') && buildPages.includes('PRODUCTION_BRANCH'),
);
check('D86 · o build da Cloudflare corre a guarda antes do build', buildPages.indexOf('guard-secrets.mjs') < buildPages.indexOf('astro.js'));

// --- SEC-52: least privilege ------------------------------------------------
check('SEC-52 · permissions topo = contents: read', doc.permissions?.contents === 'read' && Object.keys(doc.permissions ?? {}).length === 1, JSON.stringify(doc.permissions));
check(
  'SEC-52 · build job (SEC-R-07: só contents: read — sem pages: write)',
  build?.permissions?.contents === 'read' && Object.keys(build?.permissions ?? {}).length === 1,
  JSON.stringify(build?.permissions),
);
const allPerms = JSON.stringify(doc);
check('SEC-52 · sem contents: write / write-all', !/contents:\s*write|write-all/.test(allPerms));

// --- SEC-R-07: the build job cannot publish ---------------------------------
check('SEC-R-07 · o build job não tem pages: write', !('pages' in (build?.permissions ?? {})));
check('SEC-R-07 · o build job não tem id-token: write', !('id-token' in (build?.permissions ?? {})));
check('SEC-R-07 · timeout-minutes no build', typeof build?.['timeout-minutes'] === 'number', String(build?.['timeout-minutes']));

// --- SEC-53: no PAT ---------------------------------------------------------
check('SEC-53 · nenhum PAT', !/secrets\.[A-Z_]*(PAT|TOKEN|KEY)/.test(text));

// --- SEC-54: persist-credentials --------------------------------------------
const checkout = buildSteps.find((s) => s.uses?.startsWith('actions/checkout'));
check('SEC-54 · persist-credentials: false', checkout?.with?.['persist-credentials'] === false);
check('SEC-54 · o checkout é o primeiro step', buildSteps[0]?.uses?.startsWith('actions/checkout'));

// --- SEC-50: the 2 actions pinned by SHA ------------------------------------
for (const [action, sha] of Object.entries(EXPECTED)) {
  const found = used.find((u) => u.startsWith(`${action}@`));
  check(`SEC-50 · ${action}`, found === `${action}@${sha}`, found ?? 'ausente');
}
check('SEC-50 · nenhuma action por tag', !used.some((u) => /@(v[0-9]|main|master|latest)/.test(u)), used.join(', '));
check('SEC-50 · só as 2 actions do workflow (nenhuma de publicação)', used.length === Object.keys(EXPECTED).length, used.join(', '));

// --- SEC-55: the guard and the build ----------------------------------------
const guardIndex = buildRuns.findIndex((r) => r.includes('guard-secrets.mjs'));
const buildIndex = buildRuns.findIndex((r) => r.includes('npm run build'));
check('SEC-55 · step explícito da guarda', guardIndex !== -1);
check('SEC-55 · a guarda corre ANTES do build', guardIndex !== -1 && buildIndex !== -1 && guardIndex < buildIndex);
check('SEC-55 · npm ci (não npm install)', buildRuns.some((r) => /npm ci\b/.test(r)) && !buildRuns.some((r) => /npm install\b/.test(r)));
const buildStep = buildSteps.find((s) => s.run?.includes('npm run build'));
check('SEC-55 · env SITE_BASE=/', buildStep?.env?.SITE_BASE === '/');
check(
  'SEC-55 · env PUBLIC_CONTACT_ENDPOINT (vars, não secrets)',
  typeof buildStep?.env?.PUBLIC_CONTACT_ENDPOINT === 'string' &&
    buildStep.env.PUBLIC_CONTACT_ENDPOINT.includes('vars.PUBLIC_CONTACT_ENDPOINT') &&
    !/secrets\./.test(buildStep.env.PUBLIC_CONTACT_ENDPOINT),
  buildStep?.env?.PUBLIC_CONTACT_ENDPOINT ?? 'ausente',
);
check('SEC-55 · o build não usa a variável antiga do formulário', !text.includes('PUBLIC_FORMSPREE_ENDPOINT'));

// --- concurrency + environment ----------------------------------------------
check(
  'SEC-51 · concurrency por evento e ref / cancel-in-progress',
  typeof doc.concurrency?.group === 'string' &&
    doc.concurrency.group.includes('github.event_name') &&
    doc.concurrency?.['cancel-in-progress'] === true,
  doc.concurrency?.group ?? '',
);
check('SEC-49 · node-version 20 + cache npm', buildSteps.some((s) => s.with?.['node-version'] === 20 && s.with?.cache === 'npm'));

// --- SEC-R-11: the audit exception is pinned by the advisory ID --------------
const auditStep = buildSteps.find((s) => s.run?.includes('check-audit.mjs'));
check('SEC-R-11 · o audit usa scripts/check-audit.mjs', Boolean(auditStep));
check('SEC-R-11 · o audit não tolera um pacote inteiro', !buildRuns.some((r) => r.includes("k!=='astro'")));

// --- C16: as verificações correm no CI --------------------------------------
for (const script of [
  'verify-workflow.mjs',
  'check-audit.mjs',
  'guard-secrets.mjs',
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
// O `npm run check` e o `npm run check:function` são comparados **exactamente**
// — senão `npm run check:function` contaria como `npm run check`.
check('C16 · o CI corre npm run check (os tipos)', buildRuns.some((run) => run.trim() === 'npm run check'));
check('C16 · o CI corre npm run check:function (a Function)', buildRuns.some((run) => run.trim() === 'npm run check:function'));

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

console.log(`workflow ${file}: ${ok.length} verificação(ões) OK`);
for (const line of ok) console.log(`  ok   ${line}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problema(s):`);
  for (const line of problems) console.error(`  FALHA ${line}`);
  process.exit(1);
}
