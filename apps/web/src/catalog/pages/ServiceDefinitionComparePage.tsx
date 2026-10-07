import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import {
  CatalogApiError,
  getServiceDefinitionVersion,
  listServiceDefinitionVersions,
} from '../api/service-catalog-api';
import { mapCatalogErrorToMessage } from '../api/catalog-error-messages';
import {
  ModuleErrorState,
  ModuleLoadingState,
  ModulePage,
  ModulePageHeader,
} from '../../ui/module-layout';
import { VersionComparePanel } from '../components/VersionComparePanel';
import { compareServiceDefinitionVersions } from '../utils/version-compare';
import type { ServiceDefinitionVersion } from '../types/service-catalog.types';

type CompareState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready';
      versions: ServiceDefinitionVersion[];
      leftVersion: number;
      rightVersion: number;
      left: ServiceDefinitionVersion;
      right: ServiceDefinitionVersion;
    };

export function ServiceDefinitionComparePage() {
  const { definitionId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<CompareState>({ phase: 'loading' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const versions = await listServiceDefinitionVersions(definitionId);
      if (versions.length < 2) {
        setState({
          phase: 'error',
          message: 'São necessárias ao menos duas versões para comparar.',
        });
        return;
      }

      const sorted = [...versions].sort((a, b) => a.version - b.version);
      const defaultLeft = sorted.at(-2)?.version ?? sorted[0]!.version;
      const defaultRight = sorted.at(-1)?.version ?? sorted[1]!.version;
      const leftVersion = Number(searchParams.get('left') ?? defaultLeft);
      const rightVersion = Number(searchParams.get('right') ?? defaultRight);

      const [left, right] = await Promise.all([
        getServiceDefinitionVersion(definitionId, leftVersion),
        getServiceDefinitionVersion(definitionId, rightVersion),
      ]);

      setState({ phase: 'ready', versions, leftVersion, rightVersion, left, right });
    } catch (error) {
      setState({
        phase: 'error',
        message:
          error instanceof CatalogApiError
            ? mapCatalogErrorToMessage(error.code, error.status)
            : 'Não foi possível comparar as versões.',
      });
    }
  }, [definitionId, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === 'loading') {
    return (
      <ModulePage>
        <ModulePageHeader title="Comparar versões" />
        <ModuleLoadingState title="Comparar versões" message="Carregando comparação…" />
      </ModulePage>
    );
  }

  if (state.phase === 'error') {
    return (
      <ModulePage>
        <ModulePageHeader title="Comparar versões" />
        <ModuleErrorState
          title="Comparar versões"
          message={state.message}
          retryable
          onRetry={() => void load()}
        />
        <p className="mt-3 mb-0">
          <Link to={`/app/catalog/${definitionId}`}>Voltar</Link>
        </p>
      </ModulePage>
    );
  }

  const diffs = compareServiceDefinitionVersions(state.left, state.right);

  return (
    <ModulePage>
      <ModulePageHeader
        title="Comparar versões"
        description="A comparação usa as versões carregadas do servidor; nada é inferido no navegador."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <div className="flex min-w-52 flex-col gap-1.5">
          <label htmlFor="compare-left" className="text-sm font-semibold text-gray-700">
            Versão esquerda
          </label>
          <select
            id="compare-left"
            value={state.leftVersion}
            className="min-h-9 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set('left', event.target.value);
              setSearchParams(next);
            }}
          >
            {state.versions.map((version) => (
              <option key={version.id} value={version.version}>
                v{version.version} — {version.status}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-52 flex-col gap-1.5">
          <label htmlFor="compare-right" className="text-sm font-semibold text-gray-700">
            Versão direita
          </label>
          <select
            id="compare-right"
            value={state.rightVersion}
            className="min-h-9 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set('right', event.target.value);
              setSearchParams(next);
            }}
          >
            {state.versions.map((version) => (
              <option key={version.id} value={version.version}>
                v{version.version} — {version.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <VersionComparePanel
        leftVersion={state.leftVersion}
        rightVersion={state.rightVersion}
        diffs={diffs}
      />

      <p>
        <Link to={`/app/catalog/${definitionId}`}>Voltar à definição</Link>
      </p>
    </ModulePage>
  );
}
