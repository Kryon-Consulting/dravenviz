// Example sources copied into the stage by `pnpm stage docs`; the docs never retype them.
import reactMain from './examples/react-main.tsx?raw';
import htmlPage from './examples/html-basic.html?raw';
import htmlScript from './examples/html-basic.js?raw';
import dravenpdfReadme from './examples/dravenpdf-README.md?raw';

const START = '## Use it in your own backend';
const END = '## How the bundle works';

/** The quickstart section of examples/dravenpdf/README.md, verbatim. */
function dravenpdfQuickstart(readme: string): string {
  const from = readme.indexOf(START);
  const to = readme.indexOf(END);
  if (from === -1 || to === -1 || to < from) {
    throw new Error('examples/dravenpdf/README.md no longer has the quickstart section.');
  }
  return readme.slice(from, to).trim();
}

export const snippets = {
  react: reactMain.trim(),
  htmlPage: htmlPage.trim(),
  htmlScript: htmlScript.trim(),
  dravenpdf: dravenpdfQuickstart(dravenpdfReadme),
  install: `pnpm install --frozen-lockfile        # library dev dependencies only
pnpm build                            # dist/, browser bundle, asset manifest
pnpm pack:local                       # -> .pack/draven-viz-<version>.tgz and .sha256
pnpm stage docs                       # -> .stage/docs
pnpm build:docs                       # builds the docs site from the packed tarball
pnpm test:docs                        # serves .stage/docs/dist and runs the browser checks`,
  consumer: `# In your own application (the package is private; it is installed from the tarball):
pnpm add /absolute/path/to/.pack/draven-viz-0.1.0.tgz react react-dom react-is`,
};
