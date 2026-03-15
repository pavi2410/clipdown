export function parseFrontMatter(md: string): { fields: Record<string, string>; body: string } | null {
  if (!md.startsWith('---')) return null;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = md.slice(4, end);
  const body = md.slice(end + 4).replace(/^\n/, '');
  const fields: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^"|"$/g, '');
    if (key) fields[key] = value;
  }
  return { fields, body };
}
