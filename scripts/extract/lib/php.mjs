/**
 * Minimal PHP `unserialize()` for the subset WordPress uses in
 * `theme_mods_kava` and `_wp_attachment_metadata`
 * (arrays, strings, ints, doubles, booleans and null).
 *
 * Works on a Buffer because PHP's `strlen()` counts BYTES while JS strings
 * are UTF-16 — accented characters would otherwise shift every offset.
 */

/**
 * @param {string|Buffer} input
 * @returns {any}
 */
export function phpUnserialize(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  let i = 0;

  function expect(str) {
    const slice = buf.slice(i, i + str.length).toString('latin1');
    if (slice !== str) throw new Error(`expected ${str} at ${i}, got ${JSON.stringify(slice)}`);
    i += str.length;
  }

  function parse() {
    const type = String.fromCharCode(buf[i]);
    switch (type) {
      case 'N':
        expect('N;');
        return null;
      case 'b': {
        expect('b:');
        const v = buf[i] === 0x31;
        expect(v ? '1' : '0');
        expect(';');
        return v;
      }
      case 'i': {
        expect('i:');
        const end = buf.indexOf(0x3b, i); // ';'
        const v = parseInt(buf.slice(i, end).toString('latin1'), 10);
        i = end + 1;
        return v;
      }
      case 'd': {
        expect('d:');
        const end = buf.indexOf(0x3b, i);
        const v = parseFloat(buf.slice(i, end).toString('latin1'));
        i = end + 1;
        return v;
      }
      case 's': {
        expect('s:');
        const colon = buf.indexOf(0x3a, i); // ':'
        const len = parseInt(buf.slice(i, colon).toString('latin1'), 10);
        i = colon + 2; // skip ':"'
        const v = buf.slice(i, i + len).toString('utf8');
        i += len;
        expect('";');
        return v;
      }
      case 'a': {
        expect('a:');
        const colon = buf.indexOf(0x3a, i);
        const n = parseInt(buf.slice(i, colon).toString('latin1'), 10);
        i = colon + 2; // skip ':{'
        const entries = [];
        for (let k = 0; k < n; k++) {
          const key = parse();
          entries.push([key, parse()]);
        }
        expect('}');
        // PHP arrays with the keys 0..n-1 are lists.
        const isList = entries.every(([key], index) => Number(key) === index);
        if (isList) return entries.map(([, value]) => value);
        const out = {};
        for (const [key, value] of entries) out[String(key)] = value;
        return out;
      }
      default:
        throw new Error(`unsupported PHP serialized type ${JSON.stringify(type)} at ${i}`);
    }
  }

  const value = parse();
  return value;
}
