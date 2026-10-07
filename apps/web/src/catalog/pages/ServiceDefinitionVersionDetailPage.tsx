import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import {
  CatalogApiError,
  getServiceDefinition,
  getServiceDefinitionVersion,
} from '../api/service-catalog-api';
import { mapCatalogErrorToMessage } from '../api/catalog-error-messages';
import {
  ModuleDeniedState,
  ModuleErrorState,
  ModuleLoadingState,
  ModulePage,
  ModulePageHeader,
} from '../../ui/module-layout';
import { VersionStatusBadge } from '../components/VersionStatusBadge';
import { ARCHETYPE_LABELS } from '../constants/catalog-vocabulary';
import { VERSION_STATUSES, type ServiceDefinitionVersion } from '../types/service-catalog.types';
import { DefinitionList } from '../../financial-ui/DefinitionList';

type VersionDetailState =
  | { phase: 'loading' }
  | { phase: 'denied' }
  | { phase: 'not_found' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready';
      version: ServiceDefinitionVersion;
      lineageVersion: number;
      currentDraftVersion: number | null;
    };

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('pt-BR');
}

export function ServiceDefinitionVersionDetailPage() {
  const { definitionId = '', versionNumber = '' } = useParams();
  const parsedVersion = Number(versionNumber);
  const [state, setState] = useState<VersionDetailState>({ phase: 'loading' });

  const reload = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const [definition, version] = await Promise.all([
        getServiceDefinition(definitionId),
        getServiceDefinitionVersion(definitionId, parsedVersion),
      ]);
      setState({
        phase: 'ready',
        version,
        lineageVersion: definition.version,
        currentDraftVersion: definition.currentDraftVersion,
      });
    } catch (error) {
      if (error instanceof CatalogApiError) {
        if (error.kind === 'denied') {
          setState({ phase: 'denied' });
          return;
        }
        if (error.kind === 'not_found') {
          setState({ phase: 'not_found' });
          return;
        }
      }
      setState({
        phase: 'error',
        message:
          error instanceof CatalogApiError
            ? mapCatalogErrorToMessage(error.code, error.status)
            : 'Não foi possível carregar a versão.',
      });
    }
  }, [definitionId, parsedVersion]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (state.phase === 'loading') {
    return (
      <ModulePage>
        <ModulePageHeader title="Versão de serviço" />
        <ModuleLoadingState title="Versão de serviço" message="Carregando versão…" />
      </ModulePage>
    );
  }

  if (state.phase === 'denied') {
    return (
      <ModulePage>
        <ModulePageHeader title="Versão de serviço" />
        <ModuleDeniedState title="Versão de serviço" message="Acesso negado." />
        <p className="mt-3 mb-0">
          <Link to={`/app/catalog/${definitionId}`}>Voltar à definição</Link>
        </p>
      </ModulePage>
    );
  }

  if (state.phase === 'not_found') {
    return (
      <ModulePage>
        <ModulePageHeader title="Versão de serviço" />
        <ModuleErrorState
          title="Versão de serviço"
          message="Versão não encontrada."
          retryable={false}
        />
        <p className="mt-3 mb-0">
          <Link to={`/app/catalog/${definitionId}`}>Voltar à definição</Link>
        </p>
      </ModulePage>
    );
  }

  if (state.phase === 'error') {
    return (
      <ModulePage>
        <ModulePageHeader title="Versão de serviço" />
        <ModuleErrorState
          title="Versão de serviço"
          message={state.message}
          retryable
          onRetry={() => void reload()}
        />
        <p className="mt-3 mb-0">
          <Link to={`/app/catalog/${definitionId}`}>Voltar à definição</Link>
        </p>
      </ModulePage>
    );
  }

  const { version } = state;
  const isPublished = version.status === VERSION_STATUSES.Published;

  return (
    <ModulePage>
      <ModulePageHeader
        title={`${version.code} — v${version.version}`}
        action={
          <>
            <VersionStatusBadge status={version.status} />
            {!isPublished && version.status === VERSION_STATUSES.Draft ? (
              <Link
                to={`/app/catalog/${definitionId}/versions/${version.version}/edit`}
                className="button-link button-secondary"
              >
                Editar rascunho
              </Link>
            ) : null}
            {isPublished ? (
              <Link
                to={`/app/catalog/${definitionId}/versions/new`}
                className="button-link"
              >
                Criar nova versão
              </Link>
            ) : null}
          </>
        }
      />

      {isPublished ? (
        <p
          className="m-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          role="note"
        >
          Esta versão está publicada e é imutável. Para evoluir o serviço, crie uma nova versão em rascunho.
        </p>
      ) : null}

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <DefinitionList
          items={[
            { label: 'Nome', value: version.name },
            { label: 'Status', value: <VersionStatusBadge status={version.status} /> },
            { label: 'Publicada em', value: formatDateTime(version.publishedAt) },
            { label: 'Arquétipo', value: ARCHETYPE_LABELS[version.archetype] ?? version.archetype },
            { label: 'Medição', value: `${version.measurementMode} / ${version.measurementBasis}` },
            { label: 'Descrição', value: version.description ?? '—' },
          ]}
        />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <h2 className="mt-0 mb-3 text-base font-semibold text-gray-900">Configuração estruturada</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <VersionList
            title="Unidades permitidas"
            items={version.allowedUnits.map((unit) => `${unit.unitCode}${unit.isDefault ? ' (padrão)' : ''}`)}
          />
          <VersionList
            title="Modelos de preço"
            items={version.pricingModels.map((model) =>
              [
                model.modelCode,
                model.unitCode ? `/ ${model.unitCode}` : null,
                model.salePrice ? `— venda ${model.salePrice}` : null,
              ]
                .filter(Boolean)
                .join(' '),
            )}
          />
          <VersionList
            title="Requisitos de recurso"
            items={version.resourceRequirements.map(
              (item) => `${item.resourceTypeCode} (${item.requirementLevel})`,
            )}
          />
          <VersionList
            title="Requisitos de mão de obra"
            items={version.laborRequirements.map((item) => `${item.laborTypeCode} (${item.requirementLevel})`)}
          />
          <VersionList
            title="Requisitos de evidência"
            items={version.executionRequirements.map(
              (item) => `${item.requirementType} (${item.requirementLevel})`,
            )}
          />
        </div>
      </section>

      <p>
        <Link to={`/app/catalog/${definitionId}`}>Voltar à definição</Link>
      </p>
    </ModulePage>
  );
}

function VersionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="min-w-0 rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <h3 className="mt-0 mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      {items.length === 0 ? (
        <p className="m-0 text-sm text-gray-500">—</p>
      ) : (
        <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-gray-700">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
