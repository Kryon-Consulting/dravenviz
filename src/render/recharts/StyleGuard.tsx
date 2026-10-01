import { useLayoutEffect, useRef } from 'react';
import type { ReactElement } from 'react';

/**
 * Host-style isolation for `opacity` (design section 4). Opacity multiplies down the tree, so a
 * host rule such as `g { opacity: .5 }` fades the chart through every `<g>` between the root and
 * a mark. DravenViz's own groups are styled in JSX, but Recharts creates unstyled layer groups
 * (`recharts-layer`, z-index portals) and the root `<svg>`, and takes no `style` for them. This
 * guard sets an inline `opacity: 1` on the root and on every `<g>` in it, now and whenever
 * Recharts adds one (a MutationObserver on the surface). It touches only `style.opacity`.
 */
export function StyleGuard(): ReactElement {
  const marker = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const svg = marker.current?.ownerSVGElement;
    if (!svg) return;
    const apply = (): void => {
      svg.style.opacity = '1';
      for (const g of svg.querySelectorAll('g')) {
        if (g.style.opacity !== '1') g.style.opacity = '1';
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(svg, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <g ref={marker} data-dv-style-guard="" style={{ display: 'none' }} />;
}
