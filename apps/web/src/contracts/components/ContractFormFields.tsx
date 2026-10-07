import type { ReactNode } from 'react';
import { Field, Input, Select, Textarea } from '../../ui';
import type { ContractFormValues } from '../utils/contract-form-values';

export type ClientOption = {
  id: string;
  label: string;
};

type ContractFormFieldsProps = {
  mode: 'create' | 'edit';
  values: ContractFormValues;
  clients: ClientOption[];
  clientsLoading: boolean;
  disabled: boolean;
  fieldErrors?: Partial<Record<keyof ContractFormValues, string>>;
  onChange: (values: ContractFormValues) => void;
};

function update<F extends keyof ContractFormValues>(
  values: ContractFormValues,
  key: F,
  value: ContractFormValues[F],
  onChange: (values: ContractFormValues) => void,
) {
  onChange({ ...values, [key]: value });
}

/**
 * SECAO DO FORMULARIO — agrupamento SEMANTICO, nao um cartao.
 *
 * O formulario de contrato tinha 10 campos em uma unica grade continua dentro do cartao da
 * pagina: o operador lia "Dados do contrato" e nao distinguia identificacao, escopo, vigencia e
 * pagamento — tudo com o mesmo peso visual.
 *
 * Aqui entra um agrupamento LEVE (titulo de secao + separador), deliberadamente NAO-cartao:
 * o componente e consumido por DUAS superficies — a pagina de cadastro (dentro de um
 * `BuilderSection`, que ja e o cartao) e a de edicao (dentro de um `ObjectPanel`, que tambem ja
 * e uma moldura). Um cartao aqui dentro produziria cartao dentro de cartao nas duas. O que
 * agrupa e a hierarquia tipografica e o respiro, nao mais uma borda.
 */
function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3">
        <h3 className="m-0 text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
          {title}
        </h3>
        {hint ? <p className="m-0 mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
      </div>
      {/*
        GRADE DE CAMPOS — alinhamento por LINHA, nunca por celula.

        Os campos usam `gap-4` (16px): 12px vem do `gap-1.5` interno do `Field` e 4px do
        espacamento entre a ultima parte do rotulo e o controle. Medido no DOM real, cada campo
        entrega o par rotulo/controle com 12px entre eles — sem vao morto.

        O vazio de 38px que existia na celula "Unidade operacional" vinha de um `hint` POR CAMPO:
        o `Field` empilha rotulo + hint + controle, entao o campo crescia 20px e, por ser o unico
        da linha com hint, o par rotulo/controle dele saia 38px mais baixo que o do vizinho.
        A instrucao da unidade passou a viver no hint da SECAO (uma vez, valendo para o grupo),
        nao repetida em um campo isolado da grade.
      */}
      {children}
    </section>
  );
}

export function ContractFormFields({
  mode,
  values,
  clients,
  clientsLoading,
  disabled,
  fieldErrors = {},
  onChange,
}: ContractFormFieldsProps) {
  const clientLocked = mode === 'edit';
  return (
    <div className="flex flex-col gap-4">
      <FormSection
        title="Identificação comercial"
        hint="Cliente e unidade autorizada a que este contrato se vincula, com a identificação comercial da versão."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" htmlFor="contract-client" required error={fieldErrors.clientId}>
            <Select
              id="contract-client"
              value={values.clientId}
              disabled={disabled || clientLocked}
              invalid={Boolean(fieldErrors.clientId)}
              onChange={(event) => update(values, 'clientId', event.target.value, onChange)}
            >
              <option value="">{clientsLoading ? 'Carregando…' : 'Selecione…'}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Unidade operacional"
            htmlFor="contract-unit"
            required
            error={fieldErrors.unitId}
          >
            <Input
              id="contract-unit"
              value={values.unitId}
              disabled={disabled || clientLocked}
              invalid={Boolean(fieldErrors.unitId)}
              onChange={(event) => update(values, 'unitId', event.target.value, onChange)}
              placeholder="ID da unidade"
            />
          </Field>
          <Field
            label="Número do contrato"
            htmlFor="contract-number"
            required
            error={fieldErrors.contractNumber}
          >
            <Input
              id="contract-number"
              value={values.contractNumber}
              disabled={disabled}
              invalid={Boolean(fieldErrors.contractNumber)}
              onChange={(event) => update(values, 'contractNumber', event.target.value, onChange)}
            />
          </Field>
          <Field label="Título" htmlFor="contract-title" required error={fieldErrors.title}>
            <Input
              id="contract-title"
              value={values.title}
              disabled={disabled}
              invalid={Boolean(fieldErrors.title)}
              onChange={(event) => update(values, 'title', event.target.value, onChange)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Escopo" hint="O que este contrato cobre, em linguagem de negócio.">
        <Field label="Descrição do escopo" htmlFor="contract-scope">
          <Textarea
            id="contract-scope"
            value={values.scopeDescription}
            disabled={disabled}
            onChange={(event) => update(values, 'scopeDescription', event.target.value, onChange)}
            rows={3}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Vigência e moeda"
        hint="Período de validade desta versão. Sem término registrado, a vigência fica em aberto."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Vigência inicial"
            htmlFor="contract-valid-from"
            required
            error={fieldErrors.validFrom}
          >
            <Input
              id="contract-valid-from"
              type="date"
              value={values.validFrom}
              disabled={disabled}
              invalid={Boolean(fieldErrors.validFrom)}
              onChange={(event) => update(values, 'validFrom', event.target.value, onChange)}
            />
          </Field>
          <Field label="Vigência final" htmlFor="contract-valid-to">
            <Input
              id="contract-valid-to"
              type="date"
              value={values.validTo}
              disabled={disabled}
              onChange={(event) => update(values, 'validTo', event.target.value, onChange)}
            />
          </Field>
          <Field label="Moeda" htmlFor="contract-currency">
            <Input
              id="contract-currency"
              value={values.currencyCode}
              disabled={disabled}
              maxLength={3}
              onChange={(event) => update(values, 'currencyCode', event.target.value, onChange)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Condições de pagamento"
        hint="Como a cobrança desta vigência é tratada. Opcional no cadastro."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Condições de pagamento" htmlFor="contract-payment-terms">
            <Input
              id="contract-payment-terms"
              value={values.paymentTerms}
              disabled={disabled}
              onChange={(event) => update(values, 'paymentTerms', event.target.value, onChange)}
            />
          </Field>
          <Field label="Forma de pagamento" htmlFor="contract-payment-method">
            <Input
              id="contract-payment-method"
              value={values.paymentMethod}
              disabled={disabled}
              onChange={(event) => update(values, 'paymentMethod', event.target.value, onChange)}
            />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}
