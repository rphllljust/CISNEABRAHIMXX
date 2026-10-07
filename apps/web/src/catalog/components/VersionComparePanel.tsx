import type { VersionFieldDiff } from '../utils/version-compare';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '../../ui/DataTable';

type VersionComparePanelProps = {
  leftVersion: number;
  rightVersion: number;
  diffs: VersionFieldDiff[];
};

export function VersionComparePanel({ leftVersion, rightVersion, diffs }: VersionComparePanelProps) {
  return (
    <section
      className="rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
      aria-labelledby="catalog-compare-heading"
    >
      <h2
        id="catalog-compare-heading"
        className="m-0 border-b border-slate-200 px-4 py-3 text-base font-semibold text-gray-900"
      >
        Comparação v{leftVersion} × v{rightVersion}
      </h2>
      {diffs.length === 0 ? (
        <p role="status" className="m-0 px-4 py-3 text-sm text-gray-500">
          Nenhuma diferença estrutural encontrada entre as versões selecionadas.
        </p>
      ) : (
        <DataTable aria-label="Diferenças entre versões">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell scope="col">Campo</DataTableHeaderCell>
              <DataTableHeaderCell scope="col">v{leftVersion}</DataTableHeaderCell>
              <DataTableHeaderCell scope="col">v{rightVersion}</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {diffs.map((diff) => (
              <DataTableRow key={diff.field}>
                <DataTableHeaderCell scope="row" className="text-gray-700 normal-case">
                  {diff.field}
                </DataTableHeaderCell>
                <DataTableCell>
                  <pre className="m-0 max-w-[32rem] overflow-x-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap text-slate-700">
                    {diff.left}
                  </pre>
                </DataTableCell>
                <DataTableCell>
                  <pre className="m-0 max-w-[32rem] overflow-x-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap text-slate-700">
                    {diff.right}
                  </pre>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </section>
  );
}
