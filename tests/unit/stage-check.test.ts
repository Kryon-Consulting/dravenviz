import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { checkResolution } from '../../scripts/stage-consumer';

describe('checkResolution', () => {
  const fake = (entries: { source: string; real: string }[]): string => {
    const dir = mkdtempSync(join(tmpdir(), 'dv-fake-stage-'));
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'resolution.json'), JSON.stringify({ entries }));
    return dir;
  };

  test('rejects a watched package resolved outside the stage node_modules', () => {
    const dir = fake([{ source: 'react', real: '/repo/node_modules/react/index.js' }]);
    expect(() => checkResolution(dir)).toThrow(/outside/);
  });

  test('rejects react resolving to two real paths inside the stage', () => {
    const root = mkdtempSync(join(tmpdir(), 'dv-fake-stage-'));
    mkdirSync(join(root, 'node_modules'));
    const nm = join(realpathSync(root), 'node_modules');
    writeFileSync(
      join(root, 'resolution.json'),
      JSON.stringify({
        entries: [
          { source: 'react', real: join(nm, 'a', 'node_modules', 'react', 'index.js') },
          {
            source: 'react/jsx-runtime',
            real: join(nm, 'b', 'node_modules', 'react', 'jsx-runtime.js'),
          },
          { source: 'react-is', real: join(nm, 'react-is', 'index.js') },
          { source: 'react-dom', real: join(nm, 'react-dom', 'index.js') },
          { source: 'recharts', real: join(nm, 'recharts', 'index.js') },
          { source: '@draven/viz', real: join(nm, '@draven', 'viz', 'index.js') },
        ],
      }),
    );
    expect(() => checkResolution(root)).toThrow(/more than one real path/);
  });

  test('requires all five watched packages to appear in the report', () => {
    const dir = fake([]);
    writeFileSync(
      join(dir, 'resolution.json'),
      JSON.stringify({
        entries: [
          { source: 'react', real: join(realpathSync(dir), 'node_modules', 'react', 'index.js') },
        ],
      }),
    );
    expect(() => checkResolution(dir)).toThrow(/does not appear/);
  });
});
