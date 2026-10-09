# CHANGE-2026-10-09 — Odoo 18 / OCA como base candidata do Cisne

## Origem

Solicitação explícita do responsável pelo projeto em 2026-10-09: usar um ERP empresarial open source já existente no GitHub como base do **Cisne Rondônia**, evitando reconstrução do ERP genérico do zero.

## Classificação

- Tipo: decisão de engenharia solicitada pelo responsável.
- Estado: **IMPLEMENTATION SPIKE / MIGRATION CANDIDATE**.
- Branch: `migration/odoo18-cisne-rondonia`.
- Main: preservada, sem alteração destrutiva.
- Produção: **NÃO AUTORIZADA** por esta mudança.

## Decisão executada nesta branch

Base candidata:
- Odoo Community 18.0;
- OCA l10n-brazil 18.0;
- OCA field-service 18.0;
- OCA contract 18.0.

Motivo técnico:
- engine ERP consolidado;
- ecossistema open source;
- localização brasileira existente;
- Field Service para ordens/execução;
- contratos recorrentes;
- menor superfície de código proprietário do CISNE.

## Restrições honestas

1. Isto não declara homologação empresarial/fiscal do CISNE.
2. `l10n_br_fiscal`, `fieldservice` e `contract` declaram status Mature/Production-Stable em seus manifests; partes de NF-e/account brasileiro continuam Beta.
3. Regras empresariais do CISNE continuam autoritativas e devem ser mapeadas antes de substituir fluxos existentes.
4. Código Odoo Enterprise proprietário não foi copiado.
5. Obrigações LGPL/AGPL e avisos upstream devem ser preservados.

## Rollback

Excluir a branch restaura integralmente o estado anterior; a `main` não é modificada.
