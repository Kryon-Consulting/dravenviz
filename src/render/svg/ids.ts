/**
 * The id prefix for one embedding identity: `<namespace>_<chartId>-`. A namespace can never
 * contain `_` (its grammar is `^[a-z][a-z0-9-]{0,31}$`), so the first `_` always ends the
 * namespace and two different (namespace, chartId) pairs never share a prefix (design section 9).
 */
export function idPrefix(namespace: string, chartId: string): string {
  return `${namespace}_${chartId}-`;
}

/**
 * Rewrites every `id` to `<prefix><n>` in document order (n from 1) and every reference to match:
 * `url(#...)` in any attribute, `href`/`xlink:href`, `aria-labelledby` and `aria-describedby`
 * (design section 10, finalize). Recharts and React emit their own ids; none may survive.
 * Returns the old-to-new map.
 */
export function rewriteIds(root: Element, prefix: string): Map<string, string> {
  const map = new Map<string, string>();
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id !== null && !map.has(id)) map.set(id, `${prefix}${map.size + 1}`);
  }
  const target = (id: string): string => map.get(id) ?? id;
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      const v = attr.value;
      let out = v;
      if (attr.name === 'id') out = target(v);
      else if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') {
        out = v.split(/\s+/).filter(Boolean).map(target).join(' ');
      } else if (/(^|:)href$/i.test(attr.name) && v.startsWith('#')) out = `#${target(v.slice(1))}`;
      else if (v.includes('url(')) {
        out = v.replace(
          /url\(\s*(["']?)#([^)"'\s]+)\1\s*\)/g,
          (_m, _q: string, id: string) => `url(#${target(id)})`,
        );
      }
      if (out !== v) el.setAttribute(attr.name, out);
    }
  }
  return map;
}
