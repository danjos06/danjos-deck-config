/**
 * Formats bytes as a PROGMEM C++ array: `const uint8_t sym[1024] PROGMEM = { 0x00, ... };`
 * with 16 bytes per line. `symbol` is sanitised into a valid C identifier.
 */
export function toCppArray(symbol: string, b: Uint8Array): string {
  let id = symbol.replace(/[^A-Za-z0-9_]/g, '_');
  if (id === '' || /^[0-9]/.test(id)) id = `_${id}`;
  const lines: string[] = [];
  for (let i = 0; i < b.length; i += 16) {
    const row = Array.from(b.subarray(i, i + 16), (v) => `0x${v.toString(16).toUpperCase().padStart(2, '0')}`);
    lines.push(`  ${row.join(', ')}`);
  }
  return `const uint8_t ${id}[${b.length}] PROGMEM = {\n${lines.join(',\n')}\n};\n`;
}
