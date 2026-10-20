#!/usr/bin/env node
/**
 * The gate of the rotation of the secrets (SEC-67).
 *
 *   node scripts/check-rotation-gate.mjs [docs/rotation-gate.md]
 *
 * It exits with **1** while one of the 12 items of the rotation is not
 * **completely** closed: the mark `☑` **plus** a date, a responsible and the
 * sha256 of the evidence (D7). A mark without the evidence is not a rotation.
 * It blocks the **publication**, not the local development.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(process.cwd(), process.argv[2] ?? 'docs/rotation-gate.md');

let content;
try {
  content = readFileSync(FILE, 'utf8');
} catch (error) {
  console.error(`check-rotation-gate: could not read ${FILE} (${error.message}).`);
  process.exit(1);
}

/** The rows of the table of the gate. */
const rows = content
  .split('\n')
  .filter((line) => /^\|\s*\d+\s*\|/.test(line))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    return {
      number: cells[0] ?? '',
      item: cells[1] ?? '',
      state: cells[3] ?? '',
      date: cells[4] ?? '',
      owner: cells[5] ?? '',
      sha256: cells[6] ?? '',
    };
  });

if (rows.length !== 12) {
  console.error(`check-rotation-gate: expected 12 items in ${FILE}, found ${rows.length}.`);
  process.exit(1);
}

/**
 * The sha256 of the evidence — 64 hexadecimal characters.
 *
 * ⚠️ The digest is **case-insensitive** (REV-14): `Get-FileHash` on Windows
 * emits **uppercase**, and a correct digest that the gate refuses is a gate
 * that gets deleted ("a hard gate that always fails is a gate that gets
 * deleted").
 */
const SHA256 = /^[0-9a-fA-F]{64}$/;

/**
 * The fields that are still missing in a row.
 * @param {object} row
 * @returns {string[]}
 */
function missingFields(row) {
  const missing = [];
  if (!row.state.includes('☑')) missing.push('a marca ☑');
  if (!row.date || row.date === '—') missing.push('a data');
  if (!row.owner || row.owner === '—') missing.push('o responsável');
  if (!SHA256.test(row.sha256)) missing.push('o sha256 da captura (64 hexadecimais, maiúsculas ou minúsculas)');
  return missing;
}

const pending = rows
  .map((row) => ({ row, missing: missingFields(row) }))
  .filter((entry) => entry.missing.length > 0);

if (pending.length > 0) {
  console.error(
    `check-rotation-gate: ${pending.length}/12 pendentes — o gate BLOQUEIA a publicação (SEC-67):`,
  );
  for (const { row, missing } of pending) {
    console.error(
      `  - ${row.number}. ${row.item.replace(/\*\*/g, '')}\n      falta: ${missing.join(', ')}`,
    );
  }
  console.error('\nUma linha só conta como fechada com a marca ☑ E a data E o responsável E o sha256 da captura.');
  console.error('A rotação dos segredos é tarefa operacional do cliente (docs/SPEC-SECURITY.md §3).');
  console.error('O registo da evidência é docs/rotation-gate.md.');
  console.error('⚠️ Em produção o gate está CONTORNADO por decisão do dono (D88: ROTATION_GATE=skip) — a publicação está a ocorrer com as rotações por fazer.');
  process.exit(1);
}

console.log('check-rotation-gate: 12/12 rotações concluídas com evidência — a publicação está desbloqueada.');
