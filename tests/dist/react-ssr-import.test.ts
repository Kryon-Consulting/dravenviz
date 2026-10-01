import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import minLine from '../../fixtures/valid/min-line.json';

// Node, no DOM: the built React entry must import and server-render without touching `document`.
test('dist/react imports in Node and server-renders a placeholder root', async () => {
  expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  const url = pathToFileURL(join(process.cwd(), 'dist/react/index.js')).href;
  const mod = (await import(/* @vite-ignore */ url)) as {
    Chart: ComponentType<Record<string, unknown>>;
  };
  let html = '';
  expect(() => {
    html = renderToString(createElement(mod.Chart, { spec: minLine, height: 320 }));
  }).not.toThrow();
  expect(html).toMatch(/<div[^>]*class="[^"]*dravenviz-root/);
});
