import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DynamicContextDrawer,
  DynamicSavedViewsBar,
  useSavedViews,
  type CrossReference,
} from '../../engine';
import { ContractsApiError, listContracts } from '../api/contracts-api';
import { mapContractErrorToMessage } from '../api/contracts-error-messages';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
import { useContractCapabilities } from '../hooks/useContractCapabilities';
import { CONTRACT_STATUSES, type Contract } from '../types';
import {
  formatClientSnapshot,
  formatContractStatus,
  formatDate,
} from '../utils/contract-status-labels';
import { HumanLookupField } from '../../financial-ui/HumanLookupField';
import { searchClientOptions } from '../../financial-ui/client-lookup';
import { OperationalUnitOptions, useOperationalUnits } from '../../shell/hooks/useOperationalUnits';
import { WorklistStatePanel } from '../../ui/enterprise-list';
import {
  ModuleDeniedState,
  ModuleErrorState,
  ModuleLoadingState,
  ModulePage,
  ModuleStatePage,
  ModulePagination,
  ModulePrimaryLink,
  UnitScopeLabel,
} from '../../ui/module-layout';
import { cn } from '../../ui/utils/cn';

const PAGE_SIZE = 20;

/** Cabecalho denso da worklist, na mesma altura de uma linha. */
const headCellClass =
  'sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 px-2.5 py-2 text-left text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase';

const cellClass = 'relative border-b border-slate-100 py-2.5 pr-2 align-top text-slate-700';

type ListState =
  | { phase: 'loading' }
  | { phase: 'denied' }
  | { phase: 'error'; message: string; retryable: boolean }
  | { phase: 'ready'; items: Contract[]; offset: number; hasMore: boolean };

/**
 * PESO DO CICLO DE VIDA — a regra de leitura da carteira de contratos.
 *
 * Contrato ATIVO em vigor e a condicao normal: nao exige trabalho. Contrato EXPIRADO e a
 * excecao que pede o operador (a vigencia terminou e a relacao comercial esta sem cobertura).
 * Rascunho ainda nao foi ativado; encerrado ja teve o ciclo fechado. E a mesma classificacao que
 * a maquina de estados define, usada apenas para decidir contraste — nada e inferido.
 */
type LifecycleWeight = 'open' | 'attention' | 'settled';

function contractWeight(
  status: Contract['status'],
  validTo: string | null,
  now: Date,
): LifecycleWeight {
  if (status === CONTRACT_STATUSES.Expired) {
    return 'attention';
  }
  if (status === CONTRACT_STATUSES.Active) {
    // Em vigor mas a vigencia ja terminou no relogio: o dominio ainda nao marcou como expirado,
    // mas o operador precisa ver que nao ha mais vigencia.
    if (validTo) {
      const end = new Date(`${validTo}T23:59:59`);
      if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) {
        return 'attention';
      }
    }
    return 'open';
  }
  if (status === CONTRACT_STATUSES.Draft) {
    return 'open';
  }
  return 'settled';
}

export function ContractsListPage() {
  const { capabilities } = useContractCapabilities();
  const { options: unitOptions } = useOperationalUnits();
  /*
   * VISOES SALVAS — o recorte (cliente + unidade) e o que o comercial remonta ao acompanhar a
   * vigencia de uma carteira. A visao restaura o recorte SERVER-SIDE real.
   */
  const savedViews = useSavedViews('local-operator', 'contracts');
  const [selected, setSelected] = useState<Contract | null>(null);
  const [clientFilter, setClientFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [listState, setListState] = useState<ListState>({ phase: 'loading' });

  const loadPage = useCallback(
    async (offset: number, signal?: AbortSignal) => {
      setListState({ phase: 'loading' });
      try {
        const response = await listContracts(
          {
            limit: PAGE_SIZE,
            offset,
            clientId: clientFilter.trim() || undefined,
            unitId: unitFilter.trim() || undefined,
          },
          signal,
        );
        setListState({
          phase: 'ready',
          items: response.items,
          offset: response.offset,
          hasMore: response.items.length === response.limit,
        });
      } catch (error) {
        if (error instanceof ContractsApiError) {
          if (error.kind === 'denied') {
            setListState({ phase: 'denied' });
            return;
          }
          setListState({
            phase: 'error',
            message: mapContractErrorToMessage(error.code, error.status),
            retryable: error.kind === 'network' || error.kind === 'unknown',
          });
          return;
        }
        setListState({
          phase: 'error',
          message: 'Não foi possível carregar os contratos.',
          retryable: true,
        });
      }
    },
    [clientFilter, unitFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPage(0, controller.signal);
    return () => controller.abort();
  }, [loadPage]);

  if (listState.phase === 'loading') {
    return (
      <ModuleStatePage title="Contratos">
        <ModuleLoadingState message="Carregando contratos…" />
      </ModuleStatePage>
    );
  }

  if (listState.phase === 'denied') {
    return (
      <ModuleStatePage title="Contratos">
        <ModuleDeniedState message="Você não tem permissão para listar contratos comerciais." />
      </ModuleStatePage>
    );
  }

  if (listState.phase === 'error') {
    return (
      <ModuleStatePage title="Contratos">
        <ModuleErrorState
          message={listState.message}
          retryable={listState.retryable}
          onRetry={() => void loadPage(0)}
        />
      </ModuleStatePage>
    );
  }

  const { items, offset, hasMore } = listState;
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilters = Boolean(clientFilter.trim() || unitFilter.trim());
  const now = new Date();

  /**
   * A ACAO PRIMARIA EXISTE UMA VEZ, E SO.
   *
   * A tela vazia nao tem carteira para operar, entao a criacao desce para dentro do painel de
   * estado vazio (junto da explicacao do que e um contrato) e desaparece do cabecalho. Havendo
   * contrato, ou havendo recorte aplicado, ela fica no cabecalho e o painel de vazio NAO a
   * repete. As duas condicoes sao mutuamente exclusivas por construcao — nao ha caminho em que
   * os dois links coexistam.
   */
  const showCreateInHeader = capabilities.canCreate && (items.length > 0 || hasActiveFilters);
  const showCreateInEmptyState = capabilities.canCreate && items.length === 0 && !hasActiveFilters;

  /**
   * LEITURA DA CARTEIRA — contagens da PAGINA carregada, nunca do dominio.
   *
   * A listagem NAO publica `total`: so a pagina e o `hasMore`. Declarar um total aqui seria
   * inventar numero. Cada celula da faixa e rotulada "nesta página" e a paginacao continua sendo
   * a unica fonte do "tem mais".
   */
  const attentionCount = items.filter(
    (item) => contractWeight(item.status, item.validTo, now) === 'attention',
  ).length;
  const activeCount = items.filter((item) => item.status === CONTRACT_STATUSES.Active).length;
  const draftCount = items.filter((item) => item.status === CONTRACT_STATUSES.Draft).length;
  const settledCount = items.filter(
    (item) => item.status === CONTRACT_STATUSES.Closed || item.status === CONTRACT_STATUSES.Expired,
  ).length;

  return (
    <ModulePage>
      {/*
        ZONA 1 — OPERATING HEADER, uma linha. Saiu o `WorklistHeader` com paragrafo de contexto.

        ACAO PRIMARIA: UMA UNICA VEZ na tela, na forma de UMA UNICA EXPRESSAO. Antes o cabecalho
        renderizava "Novo contrato" com `capabilities.canCreate` e o empty state repetia o mesmo
        link com a MESMA condicao — na tela vazia os dois apareciam juntos, dois alvos para a
        mesma acao (medido: 2 links "Novo contrato" no estado vazio; 1 no populado). A intencao
        do comentario anterior era correta, a implementacao nao a cumpria.

        Aqui a acao nasce de UMA expressao: quando nao ha contrato nenhum e a criacao e
        permitida, ela desce para DENTRO do painel de estado vazio — que ja explica o que um
        contrato e —, e nao existe em lugar nenhum do cabecalho. Nos demais casos ela fica no
        cabecalho. Nunca nas duas. O e2e usa `getByRole('link', { name: 'Novo contrato' })`,
        que exige UM unico no; a duplicidade quebrava esse contrato.
      */}
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-1 pb-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-[19px] leading-tight font-semibold tracking-tight text-slate-900">
              Contratos
            </h1>
            <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
              Ciclo de vida comercial
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums">
              {items.length} nesta página
            </span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                hasActiveFilters
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 ring-inset'
                  : 'text-slate-500',
              )}
            >
              {hasActiveFilters ? 'recorte aplicado' : 'carteira completa'}
            </span>
          </div>
        </div>
        {showCreateInHeader ? (
          <ModulePrimaryLink to="/app/contracts/new" className="min-h-0 px-3.5 py-2 text-[13px]">
            Novo contrato
          </ModulePrimaryLink>
        ) : null}
      </header>

      {/*
        ZONA 2 — CICLO DE VIDA, nao metricas decorativas. Duas perguntas: o que esta EM VIGOR
        (leitura) e o que EXIGE o operador (expirado / vigencia terminada). OS NUMEROS SAO
        OBSERVACIONAIS, nao recortes: a listagem nao filtra por status (so cliente + unidade).
        Fazer a celula "aplicar um recorte de status" afirmaria um filtro que o servidor nao
        executa. Ela DECLARA o tamanho de cada classe; o recorte real continua na command surface.
      */}
      {items.length > 0 ? (
        <nav
          aria-label="Ciclo de vida da carteira"
          className="flex flex-wrap items-stretch border-b border-slate-200 bg-white px-1 py-2"
        >
          <QueueStripCell
            label="Vigentes"
            value={activeCount}
            hint="contratos ativos nesta página"
            weight="open"
          />
          <QueueStripCell
            label="Exigindo atenção"
            value={attentionCount}
            hint="expirados ou com vigência terminada, nesta página"
            weight={attentionCount > 0 ? 'attention' : 'settled'}
          />
          <QueueStripCell
            label="Rascunho"
            value={draftCount}
            hint="ainda não ativados"
            weight="settled"
          />
          <QueueStripCell
            label="Encerrados"
            value={settledCount}
            hint="fechados ou expirados"
            weight="settled"
          />
        </nav>
      ) : null}

      {/*
        ZONA 3 — COMMAND SURFACE. Barra unica: busca de cliente humana, unidade (escopo autorizado)
        e visoes salvas do arcabouco — sem formulario cru, sem "SAVED VIEWS" em ingles.
      */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-200 bg-slate-50/70 px-1 py-2">
        {/*
          BUSCA DE CLIENTE — `HumanLookupField` compacto NAO encolhe.

          O aviso de erro do lookup e um `<span>`/`<p>` SEM `nowrap`: como item de flex sem
          largura minima, ele era comprimido pelo select ao lado e o texto quebrava uma palavra
          por linha (medido: 46px de largura por 83px de altura, na barra de uma linha). O
          componente e COMPARTILHADO por outros modulos, entao o ajuste fica AQUI, no dono da
          barra: o wrapper reserva a largura minima e impede o encolhimento do aviso.
        */}
        <div className="flex min-w-64 flex-1 items-center gap-1.5 [&>div>span]:shrink-0 [&>div>span]:whitespace-nowrap">
          <HumanLookupField
            label="Cliente"
            htmlFor="contract-client-search"
            variant="compact"
            search={searchClientOptions}
            value={clientFilter}
            onChange={setClientFilter}
            emptyOptionLabel="Todos os clientes"
            emptyMessage="Nenhum cliente encontrado para a busca."
          />
        </div>

        <label htmlFor="contract-unit-filter" className="sr-only">
          Unidade
        </label>
        <select
          id="contract-unit-filter"
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-[0_1px_1px_rgb(15_23_42/0.03)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          value={unitFilter}
          onChange={(event) => setUnitFilter(event.target.value)}
        >
          <OperationalUnitOptions options={unitOptions} includeAllLabel="Todas as unidades" />
        </select>

        {hasActiveFilters ? (
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_1px_1px_rgb(15_23_42/0.03)] hover:bg-slate-50"
            onClick={() => {
              setClientFilter('');
              setUnitFilter('');
            }}
          >
            Limpar filtros
          </button>
        ) : null}

        {/*
          VISOES SALVAS — o mesmo arcabouco `DynamicSavedViewsBar`, GOVERNADO: alinhado a direita
          da command surface. O operador so monta o nome quando decide salvar o recorte; sem
          formulario permanente de "View name / Save view" na primeira dobra.
        */}
        <div className="ml-auto">
          <DynamicSavedViewsBar
            views={savedViews.views}
            persistedLocally={savedViews.persistedLocally}
            onSave={(name) => savedViews.save(name, { clientFilter, unitFilter }, 'list')}
            onDelete={savedViews.remove}
            onApply={(view) => {
              setClientFilter(view.filters['clientFilter'] ?? '');
              setUnitFilter(view.filters['unitFilter'] ?? '');
            }}
          />
        </div>
      </div>

      {/*
        ZONA 4 — PROCESSING WORKLIST. A lista domina a pagina. Identidade primeiro (contrato +
        titulo + cliente), decisao depois (situacao) e ciclo/vigencia por ultimo. A barra de acento
        marca o contrato que EXIGE o operador.
      */}
      {items.length === 0 ? (
        /*
          ESTADO VAZIO — a tela inteira e este painel, entao ele carrega a explicacao do dominio
          (o que um contrato e) e a UNICA acao primaria. `WorklistStatePanel` e COMPARTILHADO por
          outros modulos: o enquadramento fica no wrapper local (aqui), nunca no primitivo.
          Minimo de altura para o vazio nao deixar a tela orfa em viewport grande.
        */
        <div className="flex min-h-[18rem] flex-col justify-center px-1 py-8">
          <div className="[&>section]:mb-0 [&>section]:rounded-lg [&>section]:border-slate-200 [&>section]:px-8 [&>section]:py-10 [&>section]:shadow-[0_1px_2px_rgb(15_23_42/0.04)] [&>section>p:first-child]:text-[16px] [&>section>p:first-child]:tracking-tight [&>section>p:nth-child(2)]:mt-1.5 [&>section>p:nth-child(2)]:max-w-3xl [&>section>p:nth-child(2)]:text-[13px] [&>section>p:nth-child(2)]:leading-relaxed">
            <WorklistStatePanel
              title={
                hasActiveFilters
                  ? 'Nenhum contrato corresponde aos filtros aplicados.'
                  : 'Nenhum contrato no recorte atual.'
              }
              description={
                hasActiveFilters
                  ? 'Ajuste o cliente ou a unidade para ver outros contratos.'
                  : 'Os contratos formalizam a vigência comercial com o cliente: duração, status e unidade. Quando o primeiro for registrado, ele aparece aqui.'
              }
              action={
                hasActiveFilters ? (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_1px_1px_rgb(15_23_42/0.03)] hover:bg-slate-50"
                    onClick={() => {
                      setClientFilter('');
                      setUnitFilter('');
                    }}
                  >
                    Limpar filtros
                  </button>
                ) : showCreateInEmptyState ? (
                  <ModulePrimaryLink to="/app/contracts/new">Novo contrato</ModulePrimaryLink>
                ) : null
              }
            />
          </div>
        </div>
      ) : (
        <section aria-label="Lista de contratos" className="border-b border-slate-200">
          <table
            className="w-full border-separate border-spacing-0"
            aria-label="Lista de contratos"
          >
            <thead>
              <tr>
                <th scope="col" className={cn(headCellClass, 'pl-3')}>
                  Contrato
                </th>
                <th scope="col" className={cn(headCellClass, 'w-[16rem]')}>
                  Situação
                </th>
                <th scope="col" className={cn(headCellClass, 'w-[17rem]')}>
                  Vigência
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const weight = contractWeight(item.status, item.validTo, now);
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    /*
                     * CONTEXTO SEM ABANDONAR A LISTA — o comercial compara vigencias de varios
                     * contratos da mesma carteira. O painel lateral mostra os fatos da linha
                     * clicada sem perder o recorte; o numero continua levando a ficha.
                     */
                    onClick={() => setSelected(item)}
                  >
                    {/*
                      IDENTIDADE — contrato, titulo/objeto e cliente num bloco so, em vez de 3
                      colunas de peso igual ("Contrato" / "Codigo interno" / "Cliente").
                    */}
                    <td className={cn(cellClass, 'pl-3')}>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute top-1.5 bottom-1.5 left-0 w-[3px]',
                          weight === 'attention' ? 'bg-red-500' : 'bg-transparent',
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <Link
                            to={`/app/contracts/${item.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="text-[13px] font-semibold text-brand-800 no-underline hover:underline"
                          >
                            {item.contractNumber}
                          </Link>
                          <span className="text-[12px] text-gray-500">
                            {formatClientSnapshot(item.clientSnapshot)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-gray-500">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          {item.internalCode ? `${item.internalCode} · ` : ''}
                          <UnitScopeLabel unitId={item.unitId} />
                        </p>
                      </div>
                    </td>

                    {/* DECISAO — situacao + o fato que exige o operador. */}
                    <td className={cn(cellClass, 'z-[1]')}>
                      <ContractStatusBadge status={item.status} />
                      {item.status === CONTRACT_STATUSES.Active && item.validTo
                        ? (() => {
                            const end = new Date(`${item.validTo}T23:59:59`);
                            const past =
                              !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
                            return past ? (
                              <p className="mt-1 text-[11px] font-medium text-red-700">
                                Vigência encerrada no relógio
                              </p>
                            ) : null;
                          })()
                        : null}
                    </td>

                    {/* CICLO — a vigencia real, sem data fabricada. */}
                    <td className={cn(cellClass, 'z-[1] pr-3')}>
                      <span className="block text-[12px] text-gray-700 tabular-nums">
                        {formatDate(item.validFrom)}
                        {item.validTo
                          ? ` → ${formatDate(item.validTo)}`
                          : ' → sem término registrado'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-1 py-2">
          <p className="m-0 text-[11px] font-medium text-slate-500 tabular-nums">
            {offset + 1}–{offset + items.length} nesta página
          </p>
          <ModulePagination
            pageNumber={pageNumber}
            previousDisabled={offset === 0}
            nextDisabled={!hasMore}
            onPrevious={() => void loadPage(Math.max(0, offset - PAGE_SIZE))}
            onNext={() => void loadPage(offset + PAGE_SIZE)}
          />
        </div>
      ) : null}

      {/*
        RELACOES DO CONTRATO — montadas do que a LINHA ja traz, sem chamada de rede nova.
        Contagem de pedidos/OS/medicoes vinculadas NAO e publicada por esta listagem, entao
        nenhuma e afirmada.
      */}
      <DynamicContextDrawer
        open={selected !== null}
        title={selected ? selected.contractNumber : 'Contrato'}
        onClose={() => setSelected(null)}
        crossReferences={selected ? contractCrossReferences(selected) : []}
      >
        {selected ? (
          <Link
            to={`/app/contracts/${selected.id}`}
            className="inline-flex items-center rounded border border-brand-700 bg-brand-700 px-2.5 py-1 text-[12px] font-semibold text-white no-underline hover:bg-brand-800"
          >
            Abrir contrato
          </Link>
        ) : null}
      </DynamicContextDrawer>
    </ModulePage>
  );
}

/**
 * CELULA DA FAIXA DE CICLO DE VIDA — numero real da pagina + classe de leitura.
 *
 * NAO E BOTAO: e leitura. A listagem de contratos filtra apenas cliente + unidade; um botao que
 * "aplicasse um recorte de status" afirmaria um filtro que o backend nao executa. O numero
 * declara o tamanho de cada classe e o recorte real (cliente + unidade) vive na command surface.
 */
function QueueStripCell({
  label,
  value,
  hint,
  weight,
}: {
  label: string;
  value: number | null;
  hint: string;
  weight: 'open' | 'attention' | 'settled';
}) {
  const numberClass =
    value === null
      ? 'text-gray-300'
      : weight === 'attention' && value > 0
        ? 'text-red-700'
        : weight === 'open'
          ? 'text-gray-900'
          : 'text-gray-500';
  return (
    <div
      title={hint}
      className={cn(
        'flex min-w-[10rem] flex-1 flex-col items-start gap-1 border-r border-slate-200 px-3.5 py-1 last:border-r-0',
        weight === 'attention' && value !== null && value > 0 && 'bg-red-50/40',
      )}
    >
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-[22px] leading-none font-semibold tracking-tight tabular-nums',
            numberClass,
          )}
        >
          {value === null ? 'n/d' : value}
        </span>
        <span
          className={cn(
            'text-[10px] font-semibold tracking-[0.08em] uppercase',
            weight === 'settled' ? 'text-slate-400' : 'text-slate-600',
          )}
        >
          {label}
        </span>
      </span>
      <span className="truncate text-[10px] text-slate-400">{hint}</span>
    </div>
  );
}

/**
 * Referencias cruzadas do contrato, a partir do payload da listagem.
 * AUSENCIA e DECLARADA (sem termino = "sem termino registrado"), nunca uma data fabricada.
 */
function contractCrossReferences(item: Contract): CrossReference[] {
  const references: CrossReference[] = [];
  const client = formatClientSnapshot(item.clientSnapshot);
  references.push({ label: 'Cliente', detail: client });
  references.push({
    label: 'Vigência',
    detail: item.validTo
      ? `${formatDate(item.validFrom)} → ${formatDate(item.validTo)}`
      : `${formatDate(item.validFrom)} → sem término registrado`,
  });
  if (item.title) {
    references.push({ label: 'Objeto', detail: item.title });
  }
  if (item.scopeDescription) {
    references.push({ label: 'Escopo', detail: item.scopeDescription });
  }
  if (item.internalCode) {
    references.push({ label: 'Código interno', detail: item.internalCode });
  }
  references.push({ label: 'Situação', detail: formatContractStatus(item.status) });
  if (item.paymentTerms) {
    references.push({ label: 'Condições de pagamento', detail: item.paymentTerms });
  }
  return references;
}
