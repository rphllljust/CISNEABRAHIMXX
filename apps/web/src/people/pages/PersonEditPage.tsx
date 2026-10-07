import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listLaborTypes } from '../../catalog/api/catalog-reference-api';
import {
  ModuleDeniedState,
  ModuleErrorState,
  ModuleLoadingState,
  ModulePage,
  ModulePageHeader,
} from '../../ui/module-layout';
import { getPerson, PeopleApiError, updatePerson } from '../api/people-api';
import { mapPersonErrorToMessage } from '../api/person-error-messages';
import { PersonForm, type PersonFormValues } from '../components/PersonForm';
import { usePersonCapabilities } from '../hooks/usePersonCapabilities';
import type { Person } from '../types/person.types';

const BACK_LINK_CLASS = 'text-sm font-medium text-brand-600 no-underline hover:text-brand-700';
const EDIT_DESCRIPTION =
  'Atualize identificação e vínculo. Situação e inativação são tratadas no detalhe da pessoa.';

/**
 * Cancelamento de requisicao nao e erro do dominio.
 *
 * `AbortController.abort()` faz o `fetch` rejeitar com `DOMException` de nome `AbortError`. O
 * modulo de pessoas nao distingue esse caso, entao a tela precisa faze-lo: uma requisicao
 * descartada (cleanup de efeito, saida da tela) nao pode virar mensagem de falha para o operador.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * EDITAR PESSOA — mesma moldura estruturada do cadastro.
 *
 * A edição mostra, como fato persistido, o código e a situação da pessoa (que não se editam
 * aqui) e mantém intactos a validação do nome legal, o payload de atualização com `version`, o
 * mapeamento de erro e a navegação para o detalhe.
 */
export function PersonEditPage() {
  const { personId = '' } = useParams();
  const navigate = useNavigate();
  const { capabilities, loading: capabilitiesLoading } = usePersonCapabilities();

  const [person, setPerson] = useState<Person | null>(null);
  const [values, setValues] = useState<PersonFormValues>({
    legalName: '',
    preferredName: '',
    defaultLaborTypeCode: '',
    externalErpId: '',
  });
  const [laborTypes, setLaborTypes] = useState<Array<{ code: string; name: string }>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [legalNameError, setLegalNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    /*
      CANCELAMENTO NAO E FALHA DE CARGA.

      MEDIDO no browser real: em dev (StrictMode), o efeito monta, desmonta e remonta. O cleanup
      chama `controller.abort()`, o fetch em voo rejeita com `AbortError` — que NAO e
      `PeopleApiError` — e o catch generico pintava "Nao foi possivel carregar a Pessoa." O mesmo
      acontece ao sair da tela antes da resposta chegar. A tela existe e a API responde 200; o
      que falhou foi uma requisicao DESCARTADA de proposito.

      Prova: o mesmo cenario em build de producao (sem duplo mount) renderiza o formulario
      normalmente em qualquer latencia; em dev a mensagem de erro aparecia sempre.

      Agora a rejeicao por cancelamento e ignorada: o estado permanece em carregamento e quem
      manda na tela e a requisicao vigente (o segundo efeito). Nenhuma outra condicao de erro foi
      afrouxada.
    */
    void Promise.all([getPerson(personId, controller.signal), listLaborTypes(controller.signal)])
      .then(([loaded, types]) => {
        if (controller.signal.aborted) {
          return;
        }
        setPerson(loaded);
        setValues({
          legalName: loaded.legalName,
          preferredName: loaded.preferredName ?? '',
          defaultLaborTypeCode: loaded.defaultLaborTypeCode ?? '',
          externalErpId: loaded.externalErpId ?? '',
        });
        setLaborTypes(types);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        if (error instanceof PeopleApiError) {
          setLoadError(mapPersonErrorToMessage(error.code, error.status));
        } else {
          setLoadError('Não foi possível carregar a Pessoa.');
        }
      });
    return () => controller.abort();
  }, [personId]);

  if (capabilitiesLoading || (!person && !loadError)) {
    return (
      <ModulePage>
        <ModulePageHeader title="Editar pessoa" description={EDIT_DESCRIPTION} />
        <ModuleLoadingState title="Editar pessoa" message="Carregando…" />
      </ModulePage>
    );
  }

  if (loadError || !person) {
    return (
      <ModulePage>
        <ModulePageHeader title="Editar pessoa" description={EDIT_DESCRIPTION} />
        <ModuleErrorState
          title="Editar pessoa"
          message={loadError ?? 'Pessoa não encontrada.'}
          retryable={false}
        />
        <p className="mt-3 mb-0">
          <Link to="/app/people" className={BACK_LINK_CLASS}>
            Voltar à lista
          </Link>
        </p>
      </ModulePage>
    );
  }

  if (!capabilities.canUpdate) {
    return (
      <ModulePage>
        <ModulePageHeader title="Editar pessoa" description={EDIT_DESCRIPTION} />
        <ModuleDeniedState
          title="Editar pessoa"
          message="Você não tem permissão para editar Pessoas."
        />
        <p className="mt-3 mb-0">
          <Link to={`/app/people/${person.id}`} className={BACK_LINK_CLASS}>
            Voltar ao detalhe
          </Link>
        </p>
      </ModulePage>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person) {
      return;
    }
    const currentPerson = person;
    /*
      ERRO DE CAMPO OBRIGATORIO PERTENCE AO CAMPO.

      O formulario tem um slot proprio para isso (`legalNameError`, que o `Field` renderiza
      inline, com `aria-invalid` e a mensagem ligada ao controle). A pagina mandava a mensagem
      para `submitError`, o erro de FORMULARIO — entao o campo obrigatorio ficava sem marcacao
      enquanto a mensagem aparecia solta no topo. O cadastro (`PersonCreatePage`) ja usa o slot
      correto; aqui passou a ser igual.
    */
    if (!submitting && values.legalName.trim().length === 0) {
      setLegalNameError('Informe o nome legal.');
      setSubmitError(null);
      return;
    }
    if (submitting) {
      return;
    }

    setLegalNameError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const updated = await updatePerson(currentPerson.id, {
        version: currentPerson.version,
        legalName: values.legalName.trim(),
        preferredName: values.preferredName.trim() || null,
        defaultLaborTypeCode: values.defaultLaborTypeCode || null,
        externalErpId: values.externalErpId.trim() || null,
      });
      void navigate(`/app/people/${updated.id}`, { replace: true });
    } catch (error) {
      setSubmitError(
        error instanceof PeopleApiError
          ? mapPersonErrorToMessage(error.code, error.status)
          : 'Não foi possível salvar a Pessoa.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModulePage>
      <ModulePageHeader
        title={`Editar ${person.preferredName ?? person.legalName}`}
        description={EDIT_DESCRIPTION}
      />
      <PersonForm
        mode="edit"
        values={values}
        laborTypes={laborTypes}
        legalNameError={legalNameError}
        submitError={submitError}
        submitting={submitting}
        person={person}
        onChange={(patch) => {
          setValues((current) => ({ ...current, ...patch }));
          if (patch.legalName !== undefined && legalNameError) {
            setLegalNameError(null);
          }
        }}
        onSubmit={(event) => void handleSubmit(event)}
        cancelHref={`/app/people/${person.id}`}
      />
    </ModulePage>
  );
}
