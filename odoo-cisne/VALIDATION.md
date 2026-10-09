# Validação — Odoo 18 / OCA migration candidate

Data: 2026-10-09

## PASS executado nesta rodada

- `docker-compose.yml`: parse YAML válido.
- `addons/cisne_branding/views/branding.xml`: XML bem-formado.
- `scripts/bootstrap.sh`: `bash -n` sem erro.
- Odoo Community: tag oficial fixada em `18.0-20260908`.
- OCA addons: commits SHA fixados e fetch por SHA, evitando build variável.
- Banco lógico: nome fixo `cisne`; `list_db=False`.
- Credencial: senha não versionada; obrigatória via ambiente.
- `main`: não alterada.

## Verificações upstream

- OCA `l10n_br_base`: Mature.
- OCA `l10n_br_fiscal`: Production/Stable.
- OCA `fieldservice`: Production/Stable.
- OCA `contract`: Production/Stable.
- `l10n_br_account`, `l10n_br_nfe` e bridge `l10n_br_account_nfe`: Beta no upstream consultado; não entram no bootstrap padrão.

## NOT RUN / restrição

O ambiente desta execução não dispõe de Docker daemon nem resolução externa para executar o build completo do container. Portanto ainda faltam:

1. `docker compose build`;
2. bootstrap real do PostgreSQL + Odoo;
3. instalação real do conjunto padrão;
4. smoke `/web/login`;
5. autenticação;
6. teste de persistência/restart;
7. testes de migração dos dados do CISNE existente;
8. homologação fiscal da empresa;
9. testes RBAC e regras de domínio;
10. backup/restore e rollback do stack migrado.

Resultado: **PASS_WITH_RESTRICTIONS — migration candidate, não produção**.
