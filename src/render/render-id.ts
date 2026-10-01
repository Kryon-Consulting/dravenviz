let counter = 0;

/**
 * A fresh render id. Every commit of a chart carries the id of the render that produced it
 * (`data-dv-render-id`), so a stale commit can never satisfy readiness (design section 9, step 5).
 */
export function nextRenderId(): number {
  counter += 1;
  return counter;
}
