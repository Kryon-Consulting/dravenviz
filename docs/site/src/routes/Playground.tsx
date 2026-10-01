import { DravenVizError, validateSpec, type VizSpec } from '@draven/viz';
import { Chart, DataTable } from '@draven/viz/react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Editor } from '../components/Editor';
import { ErrorList, type Problem } from '../components/ErrorList';
import { PdfSample } from '../components/PdfSample';
import { PrintPreview } from '../components/PrintPreview';
import { buildFontZip, exportSvg, saveBlob, type FontMode, type RenderSettings } from '../export';
import { loadFixtureIndex, loadFixtureText, specHash, type FixtureInfo } from '../fixtures';

interface Applied {
  spec: VizSpec;
  settings: RenderSettings;
}

const DEFAULTS: RenderSettings = {
  theme: 'light',
  width: 680,
  height: 320,
  locale: 'en-US',
  timezone: 'UTC',
};

const NAMESPACE = 'pg';

function problemsOf(e: unknown): Problem[] {
  if (e instanceof DravenVizError) {
    if (e.issues !== undefined && e.issues.length > 0) {
      return e.issues.map((i) => ({ path: i.path, rule: i.rule, message: i.message }));
    }
    return [{ path: e.path ?? '', rule: e.code, message: e.message }];
  }
  return [{ path: '', rule: 'error', message: e instanceof Error ? e.message : String(e) }];
}

/** Parses and validates the editor text. Nothing is mounted until this passes. */
function check(text: string): { spec: VizSpec } | { problems: Problem[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      problems: [
        {
          path: '',
          rule: 'json-syntax',
          message: e instanceof Error ? e.message : 'The text is not valid JSON.',
        },
      ],
    };
  }
  try {
    return { spec: validateSpec(parsed) };
  } catch (e) {
    return { problems: problemsOf(e) };
  }
}

/** A hidden export mount proves the chart can be drawn with these options before it is shown. */
async function preflight(spec: VizSpec, settings: RenderSettings): Promise<Problem[]> {
  try {
    await exportSvg(spec, settings, 'external');
    return [];
  } catch (e) {
    return problemsOf(e);
  }
}

const positiveInt = (text: string): number | null => {
  const n = Number(text);
  return Number.isFinite(n) && n >= 1 && n <= 5000 ? Math.round(n) : null;
};

export function Playground(): ReactElement {
  const [index, setIndex] = useState<FixtureInfo[]>([]);
  const [fixtureId, setFixtureId] = useState('');
  const [original, setOriginal] = useState('');
  const [text, setText] = useState('');
  const [settings, setSettings] = useState<RenderSettings>(DEFAULTS);
  const [widthText, setWidthText] = useState(String(DEFAULTS.width));
  const [heightText, setHeightText] = useState(String(DEFAULTS.height));
  const [fontMode, setFontMode] = useState<FontMode>('embedded');
  const [applied, setApplied] = useState<Applied | null>(null);
  const [inputProblems, setInputProblems] = useState<Problem[]>([]);
  const [optionProblems, setOptionProblems] = useState<Problem[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState<string | null | undefined>(undefined);
  // Separate counters: a newer Render supersedes older Renders; option re-renders never discard a Render.
  const renderSeq = useRef(0);
  const settingsSeq = useRef(0);

  // Leak evidence for the browser tests: live chart roots and offscreen export hosts.
  useEffect(() => {
    Object.defineProperty(window, '__dvCounts', {
      configurable: true,
      get: () => ({
        roots: document.querySelectorAll('.dravenviz-root[data-dravenviz-chart]').length,
        exportHosts: document.querySelectorAll('[data-dv-export-host]').length,
      }),
    });
  }, []);

  /** Validates, proves the chart renders, then (and only then) replaces the preview. */
  const render = useCallback(
    async (source: string, using: RenderSettings, fresh: boolean): Promise<boolean> => {
      const mine = ++renderSeq.current;
      const checked = check(source);
      if ('problems' in checked) {
        if (mine !== renderSeq.current) return false;
        setInputProblems(checked.problems);
        if (fresh) setApplied(null);
        return false;
      }
      const failures = await preflight(checked.spec, using);
      if (mine !== renderSeq.current) return false;
      if (failures.length > 0) {
        setInputProblems(failures);
        if (fresh) setApplied(null);
        return false;
      }
      settingsSeq.current += 1; // a pending option re-render targets the old spec
      setInputProblems([]);
      setOptionProblems([]);
      setMessage('Rendered.');
      setApplied({ spec: checked.spec, settings: using });
      return true;
    },
    [],
  );

  const choose = useCallback(
    async (id: string): Promise<void> => {
      setFixtureId(id);
      setMessage('');
      let source: string;
      try {
        source = await loadFixtureText(id);
      } catch (e) {
        setMessage(`Could not load fixture ${id}: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      setOriginal(source);
      setText(source);
      await render(source, settings, true);
    },
    [render, settings],
  );

  // First load: the catalog, then the first fixture.
  useEffect(() => {
    let live = true;
    loadFixtureIndex().then(
      (list) => {
        if (!live) return;
        setIndex(list);
        const first = list.find((f) => f.id === 'line-weekly-flow') ?? list[0];
        if (first !== undefined) void choose(first.id);
      },
      (e: unknown) => setMessage(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
    // Runs once; `choose` is only needed for the first fixture.
  }, []);

  // Size, theme, locale and timezone changes re-render the last applied spec (debounced).
  useEffect(() => {
    if (applied === null) return;
    if (JSON.stringify(applied.settings) === JSON.stringify(settings)) return;
    const timer = window.setTimeout(() => {
      const mine = ++settingsSeq.current;
      void preflight(applied.spec, settings).then((failures) => {
        if (mine !== settingsSeq.current) return;
        if (failures.length > 0) {
          setOptionProblems(failures);
          return;
        }
        setOptionProblems([]);
        // Only if the preview still shows the spec this check was for.
        setApplied((prev) =>
          prev?.spec === applied.spec ? { spec: applied.spec, settings } : prev,
        );
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [settings, applied]);

  useEffect(() => {
    let live = true;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setCurrentHash(null);
      return;
    }
    setCurrentHash(undefined);
    specHash(parsed).then(
      (h) => live && setCurrentHash(h),
      () => live && setCurrentHash(null),
    );
    return () => {
      live = false;
    };
  }, [text]);

  const setSetting = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]): void =>
    setSettings((s) => ({ ...s, [key]: value }));

  const onValidate = (): void => {
    const checked = check(text);
    if ('problems' in checked) {
      setInputProblems(checked.problems);
      setMessage('');
    } else {
      setInputProblems([]);
      setMessage('Valid. Press Render to draw it.');
    }
  };

  const onReset = (): void => {
    setText(original);
    setMessage('Reset to the fixture.');
    void render(original, settings, false);
  };

  const withBusy = async (job: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      setMessage(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onDownloadSvg = (): Promise<void> =>
    withBusy(async () => {
      if (applied === null) return;
      const exported = await exportSvg(applied.spec, applied.settings, fontMode);
      if (fontMode === 'embedded') {
        saveBlob(new Blob([exported.svg], { type: 'image/svg+xml' }), 'chart.svg');
      } else {
        saveBlob(await buildFontZip(exported), 'chart.zip');
      }
      setMessage(fontMode === 'embedded' ? 'Downloaded chart.svg.' : 'Downloaded chart.zip.');
    });

  const onDownloadJson = (): void => {
    if (applied === null) return;
    saveBlob(
      new Blob([`${JSON.stringify(applied.spec, null, 2)}\n`], { type: 'application/json' }),
      `${applied.spec.id}.json`,
    );
  };

  const copy = (value: string, what: string): void => {
    navigator.clipboard.writeText(value).then(
      () => setMessage(`Copied ${what}.`),
      () => setMessage(`Could not copy ${what}; copy it from the page instead.`),
    );
  };

  const optionsJson = JSON.stringify(
    { ...(applied?.settings ?? settings), namespace: NAMESPACE, fontMode },
    null,
    2,
  );
  const problems = [...inputProblems, ...optionProblems];

  return (
    <div className="playground">
      <h1>Playground</h1>
      <p className="muted">
        The preview is drawn by the packed DravenViz build. Edit the JSON, press Validate or Render;
        nothing in the editor is executed.
      </p>
      <div className="row">
        <label>
          Fixture
          <select value={fixtureId} onChange={(e) => void choose(e.target.value)}>
            {index.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="columns">
        <section aria-labelledby="json-h" className="panel">
          <h2 id="json-h">Chart JSON</h2>
          <Editor value={text} onChange={setText} label="Chart JSON" />
          <div className="row buttons">
            <button type="button" onClick={onValidate}>
              Validate
            </button>
            <button type="button" onClick={() => void render(text, settings, false)}>
              Render
            </button>
            <button type="button" onClick={onReset}>
              Reset
            </button>
          </div>
          <p role="status" className="muted">
            {message}
          </p>
          <ErrorList problems={problems} />
          <section aria-labelledby="opts-h">
            <h3 id="opts-h">Options</h3>
            <div className="grid">
              <label>
                Theme
                <select
                  value={settings.theme}
                  onChange={(e) => setSetting('theme', e.target.value as RenderSettings['theme'])}
                >
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                  <option value="print">print</option>
                </select>
              </label>
              <label>
                Width
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={widthText}
                  onChange={(e) => {
                    setWidthText(e.target.value);
                    const n = positiveInt(e.target.value);
                    if (n !== null) setSetting('width', n);
                  }}
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={heightText}
                  onChange={(e) => {
                    setHeightText(e.target.value);
                    const n = positiveInt(e.target.value);
                    if (n !== null) setSetting('height', n);
                  }}
                />
              </label>
              <label>
                Locale
                <input
                  type="text"
                  value={settings.locale}
                  onChange={(e) => setSetting('locale', e.target.value)}
                />
              </label>
              <label>
                Timezone
                <input
                  type="text"
                  value={settings.timezone}
                  onChange={(e) => setSetting('timezone', e.target.value)}
                />
              </label>
              <label>
                Font mode
                <select value={fontMode} onChange={(e) => setFontMode(e.target.value as FontMode)}>
                  <option value="embedded">Embedded fonts (portable single file)</option>
                  <option value="external">External fonts (smaller)</option>
                </select>
              </label>
            </div>
          </section>
        </section>

        <section aria-labelledby="preview-h" className="panel">
          <h2 id="preview-h">Preview</h2>
          {problems.length > 0 && applied !== null ? (
            <p className="banner" role="status">
              Showing last valid render — not your current input
            </p>
          ) : null}
          <div className="preview" data-testid="preview">
            {applied === null ? (
              <p className="muted">Nothing to show yet: fix the errors and press Render.</p>
            ) : (
              <Chart
                spec={applied.spec}
                theme={applied.settings.theme}
                width={applied.settings.width}
                height={applied.settings.height}
                locale={applied.settings.locale}
                timezone={applied.settings.timezone}
                namespace={NAMESPACE}
              />
            )}
          </div>
          <div className="row buttons">
            <button
              type="button"
              disabled={applied === null || busy}
              onClick={() => void onDownloadSvg()}
            >
              {fontMode === 'embedded' ? 'Download SVG' : 'Download SVG + fonts (zip)'}
            </button>
            <button type="button" disabled={applied === null} onClick={onDownloadJson}>
              Download JSON
            </button>
            <button type="button" onClick={() => copy(optionsJson, 'options')}>
              Copy options
            </button>
            <button type="button" onClick={() => copy(text, 'JSON')}>
              Copy JSON
            </button>
          </div>
          <details onToggle={(e) => setPrintOpen(e.currentTarget.open)}>
            <summary>HTML print preview (not a PDF)</summary>
            {printOpen && applied !== null ? (
              <PrintPreview spec={applied.spec} settings={applied.settings} />
            ) : null}
          </details>
        </section>
      </div>

      {applied === null ? null : (
        <section aria-labelledby="table-h" className="panel">
          <h2 id="table-h">Data table</h2>
          <DataTable
            spec={applied.spec}
            locale={applied.settings.locale}
            timezone={applied.settings.timezone}
          />
        </section>
      )}
      <PdfSample fixtureId={fixtureId} index={index} currentHash={currentHash} />
    </div>
  );
}
