import type { ReactElement } from 'react';
import { toDataTable, type VizSpec } from '../core/index';

export interface DataTableProps {
  spec: VizSpec;
  /** Visually hide the table but keep it for assistive technology and text extraction. */
  visuallyHidden?: boolean;
  locale?: string;
  timezone?: string;
}

/**
 * The accessible data table of a chart (design section 11), as React elements. The same model
 * the print renderer uses (`toDataTable`), drawn with text nodes only: spec text is data, never
 * markup. No DOM access, so it renders on the server.
 */
export function DataTable(props: DataTableProps): ReactElement {
  const model = toDataTable(props.spec, {
    ...(props.locale === undefined ? {} : { locale: props.locale }),
    ...(props.timezone === undefined ? {} : { timezone: props.timezone }),
  });
  const cls =
    props.visuallyHidden === true
      ? 'dravenviz-root dravenviz-table-root dravenviz-visually-hidden'
      : 'dravenviz-root dravenviz-table-root';
  return (
    <div className={cls} data-dravenviz-table={props.spec.id}>
      <table className="dravenviz-table">
        <caption>{model.caption}</caption>
        <thead>
          <tr>
            {model.columns.map((col, i) => (
              <th key={i} scope="col" data-align={col.align}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.id} data-row-id={row.id}>
              <th scope="row">{row.header}</th>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  data-state={cell.state}
                  data-align={model.columns[i + 1]?.align ?? 'end'}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {model.notes.length > 0 ? (
        <ul className="dravenviz-table-notes">
          {model.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
