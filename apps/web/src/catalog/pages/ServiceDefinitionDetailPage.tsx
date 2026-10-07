import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useId, useState } from 'react';
import {
  activateServiceDefinition,
  CatalogApiError,
  deactivateServiceDefinition,
  getServiceDefinition,
  listServiceDefinitionVersions,
  publishServiceDefinitionVersion,
} from '../api/service-catalog-api';
import {
  DEACTIVATION_CONSEQUENCE_MESSAGE,
  mapCatalogErrorToMessage,
} from '../api/catalog-error-messages';
import { ConfirmDialog } from '../../clients/components/ConfirmDialog';
import {
  ModuleDeniedState,
  ModuleErrorState,
  ModuleLoadingState,
  ModulePage,
  ModulePageHeader,
} from '../../ui/module-layout';
import { ServiceDefinitionStatusBadge } from '../components/ServiceDefinitionStatusBadge';
import { VersionConflictNotice } from '../components/VersionConflictNotice';
import { VersionStatusBadge } from '../components/VersionStatusBadge';
import { useCatalogCapabilities } from '../hooks/useCatalogCapabilities';
import { DefinitionList } from '../../financial-ui/DefinitionList';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '../../ui/DataTable';
import {
  CATALOG_LINEAGE_STATUSES,
  VERSION_STATUSES,
  type ServiceDefinition,
  type ServiceDefinitionVersion,
} from '../types/service-catalog.types';

type DetailState =
  | { phase: 'loading' }
  | { phase: 'denied' }
  | { phase: 'not_found' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; definition: ServiceDefinition; versions: ServiceDefinitionVersion[] };

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('pt-BR');
}

export function ServiceDefinitionDetailPage() {
  const { definitionId = '' } = useParams();
  const reasonId = useId();
  const { capabilities } = useCatalogCapabilities();
  const [state, setState] = useState<DetailState>({ phase: 'loading' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [publishVersion, setPublishVersion] = useState<number | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setState({ phase: 'loading' });
    setActionError(null);
    setVersionConflict(false);
    try {
      const [definition, versions] = await Promise.all([
        getServiceDefinition(definitionId),
        listServiceDefinitionVersions(definitionId),
      ]);
      setState({ phase: 'ready', definition, versions });
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
            : 'Não foi possível carregar a definição.',
      });
    }
  }, [definitionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function withLineageMutation(
    action: (lineageVersion: number) => Promise<void>,
  ): Promise<void> {
    if (state.phase !== 'ready') {
      return;
    }
    setActionSubmitting(true);
    setActionError(null);
    try {
      await action(state.definition.version);
      await reload();
    } catch (error) {
      if (error instanceof CatalogApiError && error.kind === 'version_conflict') {
        setVersionConflict(true);
      }
      setActionError(
        error instanceof CatalogApiError
          ? mapCatalogErrorToMessage(error.code, error.status)
          : 'Não foi possível concluir a operação.',
      );
    } finally {
      setActionSubmitting(false);
    }
  }

  if (state.phase === 'loading') {
    return (
      <ModulePage>
        <ModulePageHeader title="Definição de serviço" />
        <ModuleLoadingState title="Definição de serviço" message="Carregando definição…" />
      </ModulePage>
    );
  }

  if (state.phase === 'denied') {
    return (
      <ModulePage>
        <ModulePageHeader title="Definição de serviço" />
        <ModuleDeniedState
          title="Definição de serviço"
          message="Você não tem permissão para consultar esta definição."
        />
        <p className="mt-3 mb-0">
          <Link to="/app/catalog">Voltar à lista</Link>
        </p>
      </ModulePage>
    );
  }

  if (state.phase === 'not_found') {
    return (
      <ModulePage>
        <ModulePageHeader title="Definição de serviço" />
        <ModuleErrorState
          title="Definição de serviço"
          message="Definição não encontrada."
          retryable={false}
        />
        <p className="mt-3 mb-0">
          <Link to="/app/catalog">Voltar à lista</Link>
        </p>
      </ModulePage>
    );
  }

  if (state.phase === 'error') {
    return (
      <ModulePage>
        <ModulePageHeader title="Definição de serviço" />
        <ModuleErrorState
          title="Definição de serviço"
          message={state.message}
          retryable
          onRetry={() => void reload()}
        />
      </ModulePage>
    );
  }

  const { definition, versions } = state;
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  return (
    <ModulePage>
      <ModulePageHeader
        title={definition.code}
        action={
          <>
            <ServiceDefinitionStatusBadge status={definition.status} />
            {capabilities.canUpdate && definition.currentDraftVersion === null ? (
              <Link
                to={`/app/catalog/${definition.id}/versions/new`}
                className="button-link button-secondary"
              >
                Criar nova versão
              </Link>
            ) : null}
            {capabilities.canDeactivate && definition.status === CATALOG_LINEAGE_STATUSES.Active ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => setDeactivateOpen(true)}
              >
                Desativar definição
              </button>
            ) : null}
            {capabilities.canActivate && definition.status === CATALOG_LINEAGE_STATUSES.Inactive ? (
              <button type="button" onClick={() => setActivateOpen(true)}>
                Reativar definição
              </button>
            ) : null}
          </>
        }
      />

      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {versionConflict ? <VersionConflictNotice onReload={() => void reload()} /> : null}

      <section
        className="rounded-md border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
        aria-labelledby="definition-admin-heading"
      >
        <h2 id="definition-admin-heading" className="mt-0 mb-3 text-base font-semibold text-gray-900">
          Linha de definição
        </h2>
        <DefinitionList
          items={[
            { label: 'Versão de concorrência (lineage)', value: definition.version },
            { label: 'Última versão publicada', value: definition.latestPublishedVersion ?? '—' },
            { label: 'Rascunho atual', value: definition.currentDraftVersion ?? '—' },
            { label: 'Atualizado em', value: formatDateTime(definition.updatedAt) },
          ]}
        />
      </section>

      <section
        className="rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
        aria-labelledby="versions-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id="versions-heading" className="m-0 text-base font-semibold text-gray-900">
            Versões
          </h2>
          {versions.length >= 2 ? (
            <Link
              to={`/app/catalog/${definition.id}/compare`}
              className="button-link button-secondary"
            >
              Comparar versões
            </Link>
          ) : null}
        </div>
        <DataTable aria-label="Versões da definição">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell scope="col">Versão</DataTableHeaderCell>
              <DataTableHeaderCell scope="col">Status</DataTableHeaderCell>
              <DataTableHeaderCell scope="col">Nome</DataTableHeaderCell>
              <DataTableHeaderCell scope="col">Publicada em</DataTableHeaderCell>
              <DataTableHeaderCell scope="col">Ações</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {sortedVersions.map((version) => (
              <DataTableRow key={version.id}>
                <DataTableCell className="font-semibold text-gray-900">v{version.version}</DataTableCell>
                <DataTableCell>
                  <VersionStatusBadge status={version.status} />
                </DataTableCell>
                <DataTableCell>{version.name}</DataTableCell>
                <DataTableCell>{formatDateTime(version.publishedAt)}</DataTableCell>
                <DataTableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/app/catalog/${definition.id}/versions/${version.version}`}>
                      Detalhe
                    </Link>
                    {version.status === VERSION_STATUSES.Draft && capabilities.canUpdate ? (
                      <Link to={`/app/catalog/${definition.id}/versions/${version.version}/edit`}>
                        Editar rascunho
                      </Link>
                    ) : null}
                    {version.status === VERSION_STATUSES.Draft && capabilities.canPublish ? (
                      <button type="button" onClick={() => setPublishVersion(version.version)}>
                        Publicar
                      </button>
                    ) : null}
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
        <p className="m-0 border-t border-slate-100 px-4 py-3 text-xs text-gray-500" role="note">
          Versões publicadas não são editáveis diretamente. Para alterar, crie uma nova versão em rascunho.
        </p>
      </section>

      <p>
        <Link to="/app/catalog">Voltar à lista</Link>
      </p>

      <ConfirmDialog
        open={deactivateOpen}
        title="Desativar definição"
        description={DEACTIVATION_CONSEQUENCE_MESSAGE}
        confirmLabel={actionSubmitting ? 'Desativando…' : 'Confirmar desativação'}
        confirmDisabled={actionSubmitting}
        onCancel={() => {
          if (!actionSubmitting) {
            setDeactivateOpen(false);
            setDeactivateReason('');
          }
        }}
        onConfirm={() =>
          void withLineageMutation(async (lineageVersion) => {
            const reason = deactivateReason.trim();
            if (!reason) {
              setActionError('Informe o motivo da desativação.');
              return;
            }
            await deactivateServiceDefinition(definition.id, { lineageVersion, reason });
            setDeactivateOpen(false);
            setDeactivateReason('');
          })
        }
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={reasonId} className="text-sm font-semibold text-gray-700">
            Motivo da desativação
          </label>
          <textarea
            id={reasonId}
            value={deactivateReason}
            onChange={(event) => setDeactivateReason(event.target.value)}
            rows={3}
            required
            disabled={actionSubmitting}
            className="min-h-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={activateOpen}
        title="Reativar definição"
        description="A definição voltará ao status ativo para novas operações."
        confirmLabel={actionSubmitting ? 'Reativando…' : 'Confirmar reativação'}
        confirmDisabled={actionSubmitting}
        onCancel={() => {
          if (!actionSubmitting) {
            setActivateOpen(false);
          }
        }}
        onConfirm={() =>
          void withLineageMutation(async (lineageVersion) => {
            await activateServiceDefinition(definition.id, { lineageVersion });
            setActivateOpen(false);
          })
        }
      />

      <ConfirmDialog
        open={publishVersion !== null}
        title={`Publicar versão v${publishVersion ?? ''}`}
        description="A publicação é validada pelo backend. Versões publicadas tornam-se imutáveis."
        confirmLabel={actionSubmitting ? 'Publicando…' : 'Confirmar publicação'}
        confirmDisabled={actionSubmitting}
        onCancel={() => {
          if (!actionSubmitting) {
            setPublishVersion(null);
          }
        }}
        onConfirm={() =>
          void withLineageMutation(async (lineageVersion) => {
            if (publishVersion === null) {
              return;
            }
            await publishServiceDefinitionVersion(definition.id, publishVersion, {
              lineageVersion,
            });
            setPublishVersion(null);
          })
        }
      />
    </ModulePage>
  );
}
