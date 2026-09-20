# AK Call Center

CRM/call center para consignado. Projeto independente dos sistemas antigos.

## Importação
Suporta `.xls`, `.xlsx`, `.ods` e `.csv`, com detecção de delimitador, preview, mapeamento de colunas, normalização de telefone e relatório de duplicidades.

## Não perturbe / opt-out
O sistema possui uma lista central de bloqueio:
- Cliente pediu para não receber mais ligações
- Número bloqueado
- Lista externa de "Não Me Perturbe"
- Bloqueio por CPF e/ou telefone
- Bloqueio verificado antes de colocar o lead na fila
- Registro de origem, data, motivo e operador
- Leads bloqueados ficam fora da fila automaticamente

## Stack
Next.js + TypeScript + Tailwind/shadcn-ready + Supabase.
