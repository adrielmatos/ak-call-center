-- =========================================================================
-- MIGRAÇÃO DE HARDENING: A&K SOLUÇÕES FINANCEIRAS (MULTI-TENANCY & LGPD)
-- =========================================================================

-- 1. Criação de schema privado para funções de contexto de tenant
create schema if not exists private;

-- 2. Função segura para extração de tenant_id a partir do usuário autenticado
create or replace function private.current_operator_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.operadores
  where auth_user_id = (select auth.uid()) and ativo = true
  limit 1;
$$;

revoke all on function private.current_operator_tenant_id() from public;
grant execute on function private.current_operator_tenant_id() to authenticated;

-- 3. Índices de alta performance para isolamento de dados por empresa e busca
create index if not exists idx_operadores_auth_empresa on public.operadores(auth_user_id, empresa_id) where ativo = true;

-- 4. Função auxiliar para mascaramento de CPF em conformidade com a LGPD
-- Exibe apenas os dígitos centrais (ex: ***.123.456-**) para operadores comuns
create or replace function public.mascarar_cpf(p_cpf text)
returns text
language plpgsql
immutable
as $$
declare
  v_clean text;
begin
  if p_cpf is null or length(trim(p_cpf)) = 0 then
    return '';
  end if;
  v_clean := regexp_replace(p_cpf, '\D', '', 'g');
  if length(v_clean) = 11 then
    return '***.' || substr(v_clean, 4, 3) || '.' || substr(v_clean, 7, 3) || '-**';
  end if;
  return '***.***.***-**';
end;
$$;

-- 5. Garantir RLS ativo em todas as tabelas sensíveis de crédito e compliance
alter table if exists public.operadores enable row level security;
alter table if exists public.audit_logs enable row level security;
alter table if exists public.consent_logs enable row level security;
