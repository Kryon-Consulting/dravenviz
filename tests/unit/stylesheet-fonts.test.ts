import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

// The library registers only the internal family "DravenViz Noto Sans" (design section 9), so
// the stylesheets must name it first; a bare 'Noto Sans' is never registered by DravenViz.
describe.each(['src/styles/dravenviz.css', 'examples/dravenpdf/bundle/report.css'])(
  '%s',
  (file) => {
    const css = readFileSync(file, 'utf8');
    test('every Noto Sans font stack starts with the registered internal family', () => {
      const stacks = css.match(/'(?:DravenViz )?Noto Sans'/g) ?? [];
      expect(stacks.length).toBeGreaterThan(0);
      const bare = css.match(/(?<!DravenViz )'Noto Sans'/g) ?? [];
      const internal = css.match(/'DravenViz Noto Sans'/g) ?? [];
      expect(internal.length).toBe(bare.length);
      expect(css).toMatch(/'DravenViz Noto Sans',\s*'Noto Sans',\s*sans-serif/);
    });
  },
);
