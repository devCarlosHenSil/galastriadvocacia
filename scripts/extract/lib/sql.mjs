/**
 * Streaming parser for a `mysqldump` with `--extended-insert` disabled
 * (one `INSERT INTO ... VALUES (...);` statement per line).
 *
 * The unescaping is done in a single left-to-right pass: when a backslash is
 * found the escape sequence is consumed as a unit, so `\\` can never be
 * re-interpreted as the start of another escape. This is what keeps the real
 * `\n` inside the Gutenberg `post_content` literals from being corrupted.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const ESCAPES = {
  '0': '\0',
  "'": "'",
  '"': '"',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
  '\\': '\\',
};

const INSERT_RE = /^INSERT INTO `([^`]+)` VALUES\s/i;

/**
 * Parse a single SQL value tuple starting at the `(`.
 * @param {string} src
 * @param {number} start index of the opening parenthesis
 * @returns {{ values: Array<string|number|null>, end: number }}
 */
export function parseValueTuple(src, start) {
  const values = [];
  let i = start + 1;

  for (;;) {
    while (src[i] === ' ' || src[i] === '\t') i++;

    if (src[i] === "'") {
      let out = '';
      i++;
      for (;;) {
        const c = src[i];
        if (c === undefined) throw new Error('unterminated string literal');
        if (c === '\\') {
          const e = src[i + 1];
          out += e === undefined ? '\\' : (ESCAPES[e] ?? e);
          i += 2;
          continue;
        }
        if (c === "'") {
          if (src[i + 1] === "'") {
            out += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        out += c;
        i++;
      }
      values.push(out);
    } else {
      let j = i;
      while (j < src.length && src[j] !== ',' && src[j] !== ')') j++;
      const raw = src.slice(i, j).trim();
      if (raw === '' || raw === 'NULL') values.push(null);
      else if (/^-?\d+$/.test(raw)) values.push(Number(raw));
      else if (/^-?\d*\.\d+(e[+-]?\d+)?$/i.test(raw)) values.push(Number(raw));
      else values.push(raw);
      i = j;
    }

    if (src[i] === ',') {
      i++;
      continue;
    }
    if (src[i] === ')') {
      i++;
      break;
    }
    throw new Error(`unexpected character ${JSON.stringify(src[i])} at ${i}`);
  }

  return { values, end: i };
}

/**
 * Parse one `INSERT INTO `table` VALUES (...);` line.
 * @param {string} line
 * @returns {{ table: string, values: Array<string|number|null> } | null}
 */
export function parseInsertLine(line) {
  const m = INSERT_RE.exec(line);
  if (!m) return null;
  const { values } = parseValueTuple(line, m[0].length);
  return { table: m[1], values };
}

/**
 * Stream every INSERT row of a dump file.
 * @param {string} filePath
 * @returns {AsyncGenerator<{ table: string, values: Array<string|number|null> }>}
 */
export async function* streamInserts(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.startsWith('INSERT INTO ')) continue;
    const parsed = parseInsertLine(line);
    if (parsed) yield parsed;
  }
}
