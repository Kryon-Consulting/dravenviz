import { useEffect, useState, type ReactElement } from 'react';
import type { FixtureInfo } from '../fixtures';

interface Report {
  instances: { fixture: string; specSha256: string }[];
  dravenpdf: { commit: string; options: Record<string, unknown> };
  chromium: string;
}

interface Props {
  fixtureId: string;
  index: FixtureInfo[];
  /** Spec hash of the JSON in the editor: null when it is not valid JSON, undefined while computing. */
  currentHash: string | null | undefined;
}

/** Link to the real DravenPDF sample, with its spec hash; flags it as the original fixture sample. */
export function PdfSample({ fixtureId, index, currentHash }: Props): ReactElement {
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => {
    let live = true;
    fetch('evidence/pdf/report-slice1.json')
      .then((r) => (r.ok ? (r.json() as Promise<Report>) : null))
      .then((r) => live && setReport(r))
      .catch(() => live && setReport(null));
    return () => {
      live = false;
    };
  }, []);
  const instances = report?.instances ?? [];
  // `currentHash` is the canonical spec hash; each PDF instance is compared through the catalog
  // hash of the fixture it was drawn from (the PDF itself records the file's SHA-256).
  const hashOf = (fixture: string): string | undefined =>
    index.find((f) => f.id === fixture)?.specHash;
  const match = instances.find((i) => hashOf(i.fixture) === currentHash);
  const shown =
    match ??
    instances.find((i) => i.fixture === fixtureId) ??
    instances.find((i) => i.fixture === 'line-weekly-flow');
  return (
    <section aria-labelledby="pdf-h" className="panel" data-testid="pdf-sample">
      <h3 id="pdf-h">Sample PDF</h3>
      <p>
        <a href="evidence/pdf/report-slice1.pdf" target="_blank" rel="noreferrer">
          evidence/pdf/report-slice1.pdf
        </a>{' '}
        (real DravenPDF output)
      </p>
      {shown === undefined ? null : (
        <p>
          SHA-256 of the <code>{shown.fixture}</code> fixture file drawn in the PDF:{' '}
          <code>{shown.specSha256}</code>
        </p>
      )}
      {report === null || currentHash === undefined ? null : match === undefined ? (
        <p className="badge" role="status">
          Original fixture sample: this PDF was made from the unedited fixture JSON and fixed
          options, not from the JSON in the editor.
        </p>
      ) : (
        <p>The editor JSON has the same spec hash as the PDF instance for {match.fixture}.</p>
      )}
      {report === null ? null : (
        <p className="muted">
          DravenPDF {report.dravenpdf.commit}, {report.chromium}, options:{' '}
          <code>{JSON.stringify(report.dravenpdf.options)}</code>
        </p>
      )}
    </section>
  );
}
