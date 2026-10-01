/**
 * `@draven/viz/react`: the React `<Chart>` and `<DataTable>` (design section 9). Importing this
 * module touches no DOM; every browser call happens in an effect.
 */
export { Chart, type ChartProps, type DatumEvent, type ReadyInfo } from './Chart';
export { DataTable, type DataTableProps } from './DataTable';
