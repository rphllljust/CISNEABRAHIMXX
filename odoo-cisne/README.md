# Cisne Rondônia ERP — base Odoo Community 18 + OCA Brasil

Esta branch é uma migração reversível para usar um ERP open source maduro como engine do Cisne, em vez de reconstruir do zero as capacidades genéricas já consolidadas.

## Stack desta base

- Odoo Community 18.0
- PostgreSQL 16
- OCA l10n-brazil 18.0
- OCA Field Service 18.0
- OCA Contract 18.0
- Addon próprio `cisne_branding`

A versão 18.0 foi escolhida porque o próprio repositório OCA/l10n-brazil recomenda 18.0 para novos projetos brasileiros de maior complexidade; a branch 19.0 está declarada como transição técnica.

## O que sobe por padrão

O bootstrap instala apenas o conjunto governado abaixo:

- CRM/contatos e vendas
- compras
- estoque
- contabilidade base Odoo
- projetos
- manutenção
- frota
- timesheet
- contratos recorrentes OCA
- Field Service OCA
- localização brasileira base OCA
- motor fiscal brasileiro OCA
- branding Cisne Rondônia

NF-e/NFS-e/CT-e/MDF-e e bridges contábeis brasileiras existem no repositório OCA carregado na imagem, mas **não são auto-instalados** nesta primeira camada porque há módulos com status Beta e dependências/regra fiscal que exigem homologação específica da empresa.

## Executar

1. Copie `.env.example` para `.env`.
2. Defina uma senha forte em `CISNE_DB_PASSWORD`.
3. Execute:

```bash
docker compose up --build
```

4. Acesse `http://localhost:8069/web/login`.

A base de dados fica fixada em `cisne`, e o gerenciador de bancos fica desabilitado.

## Segurança e produção

Esta branch não altera a `main`. Ela ainda não é release de produção. Antes de merge/promote:

- pin do digest da imagem Odoo;
- CI de build do container;
- smoke test de login;
- testes de instalação dos módulos;
- migração de dados do CISNE atual;
- mapeamento de autorização/RBAC;
- teste fiscal em homologação;
- backup/restore;
- rollback;
- revisão das obrigações LGPL/AGPL.

## Princípio de domínio

Odoo/OCA fornecem engine e capacidades técnicas. Regras empresariais específicas do Cisne não são inventadas nem substituídas automaticamente por defaults do ERP upstream.
