import { mountCharts } from '@draven/viz/print';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { RenderSettings } from '../export';

interface Props {
  spec: unknown;
  settings: RenderSettings;
}

/**
 * The chart at 178 mm of CSS width through `mountCharts` with `fit: "width"`: the same logical
 * layout the PDF uses, scaled to the printed width. It is an HTML preview, not a PDF.
 */
export function PrintPreview({ spec, settings }: Props): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    let live = true;
    const handle = mountCharts(el, [spec], {
      width: settings.width,
      height: settings.height,
      theme: 'print',
      namespace: 'pp',
      locale: settings.locale,
      timezone: settings.timezone,
      fit: 'width',
    });
    handle.ready.then(
      () => live && setError(''),
      (e: unknown) => {
        const code = (e as { code?: string }).code;
        if (live && code !== 'DISPOSED') setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      live = false;
      handle.dispose();
    };
  }, [spec, settings]);
  return (
    <div>
      <div
        className="print-frame"
        style={{ width: '178mm' }}
        ref={host}
        data-testid="print-preview"
      />
      {error === '' ? null : <p role="alert">{error}</p>}
    </div>
  );
}
