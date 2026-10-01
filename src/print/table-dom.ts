import { toDataTable, type DataTable, type VizSpec } from '../core/index';

export interface DataTableOptions {
  /** Visually hide the table but keep it for assistive technology and print text extraction. */
  visuallyHidden?: boolean;
  locale?: string;
  timezone?: string;
}

function text(doc: Document, tag: string, content: string): HTMLElement {
  const el = doc.createElement(tag);
  // Text nodes only: spec text is data, never markup (design section 12).
  el.appendChild(doc.createTextNode(content));
  return el;
}

/** Builds the `<table>` DOM for a data table model. No `innerHTML`. */
export function buildTableElement(doc: Document, model: DataTable): HTMLTableElement {
  const table = doc.createElement('table');
  table.className = 'dravenviz-table';
  table.appendChild(text(doc, 'caption', model.caption));

  const head = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  for (const col of model.columns) {
    const th = text(doc, 'th', col.label);
    th.setAttribute('scope', 'col');
    th.setAttribute('data-align', col.align);
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);

  const body = doc.createElement('tbody');
  for (const row of model.rows) {
    const tr = doc.createElement('tr');
    tr.setAttribute('data-row-id', row.id);
    const th = text(doc, 'th', row.header);
    th.setAttribute('scope', 'row');
    tr.appendChild(th);
    row.cells.forEach((cell, i) => {
      const td = text(doc, 'td', cell.text);
      td.setAttribute('data-state', cell.state);
      td.setAttribute('data-align', model.columns[i + 1]?.align ?? 'end');
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
  table.appendChild(body);
  return table;
}

/**
 * Renders the data table of `spec` into `target` (design section 11) and returns a function that
 * removes it again (idempotent). The table sits in its own `.dravenviz-root` wrapper so the
 * stylesheet scope applies, and is visually hidden when `visuallyHidden` is set.
 */
export function renderDataTable(
  target: Element,
  spec: VizSpec,
  options: DataTableOptions = {},
): () => void {
  const doc = target.ownerDocument;
  const model = toDataTable(spec, {
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    ...(options.timezone === undefined ? {} : { timezone: options.timezone }),
  });
  const wrap = doc.createElement('div');
  wrap.className =
    options.visuallyHidden === true
      ? 'dravenviz-root dravenviz-table-root dravenviz-visually-hidden'
      : 'dravenviz-root dravenviz-table-root';
  wrap.setAttribute('data-dravenviz-table', spec.id);
  wrap.appendChild(buildTableElement(doc, model));
  if (model.notes.length > 0) {
    const list = doc.createElement('ul');
    list.className = 'dravenviz-table-notes';
    for (const note of model.notes) list.appendChild(text(doc, 'li', note));
    wrap.appendChild(list);
  }
  target.appendChild(wrap);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    wrap.remove();
  };
}
