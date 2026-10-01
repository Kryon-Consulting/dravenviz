// Module customization hooks: write every module URL that is actually loaded to stderr.
export async function load(url, context, nextLoad) {
  process.stderr.write(`DV_LOAD ${url}\n`);
  return nextLoad(url, context);
}
