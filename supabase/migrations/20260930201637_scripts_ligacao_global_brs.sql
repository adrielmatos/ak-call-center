create table if not exists public.scripts_ligacao (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  nome text not null,
  conteudo text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid references public.operadores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scripts_ligacao_ativo_ordem on public.scripts_ligacao(ativo, ordem);
alter table public.scripts_ligacao enable row level security;

grant select, insert, update, delete on public.scripts_ligacao to authenticated;

drop policy if exists scripts_ligacao_select on public.scripts_ligacao;
create policy scripts_ligacao_select on public.scripts_ligacao
for select to authenticated
using (ativo = true or private.current_operator_is_owner());

drop policy if exists scripts_ligacao_insert on public.scripts_ligacao;
create policy scripts_ligacao_insert on public.scripts_ligacao
for insert to authenticated
with check (private.current_operator_is_owner());

drop policy if exists scripts_ligacao_update on public.scripts_ligacao;
create policy scripts_ligacao_update on public.scripts_ligacao
for update to authenticated
using (private.current_operator_is_owner())
with check (private.current_operator_is_owner());

drop policy if exists scripts_ligacao_delete on public.scripts_ligacao;
create policy scripts_ligacao_delete on public.scripts_ligacao
for delete to authenticated
using (private.current_operator_is_owner());

insert into public.scripts_ligacao (chave,nome,conteudo,ativo,ordem)
values
('INSS','INSS',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar com você por um minutinho?"

MOTIVO
"Estou entrando em contato sobre uma possibilidade de crédito para beneficiários do INSS. Quero verificar, por meio de uma simulação, se existe alguma opção compatível com o seu perfil."

QUALIFICAÇÃO
"Você já possui algum consignado ou cartão hoje? Está buscando um valor novo, reduzir parcela ou apenas conhecer as condições?"

FECHAMENTO
"Se houver uma opção, eu te apresento valor, parcela, prazo e demais condições para você analisar antes de qualquer contratação."$script$,true,1),
('Consignado Público','Consignado Público',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso explicar rapidamente o motivo da ligação?"

MOTIVO
"Atendemos soluções de crédito consignado para servidores públicos. Quero verificar se existe alguma condição disponível para o seu vínculo, sempre sujeita à análise."

QUALIFICAÇÃO
"Você é servidor ativo, aposentado ou pensionista? Já possui algum consignado e está buscando crédito novo, redução de parcela ou portabilidade?"

FECHAMENTO
"Posso fazer uma simulação e te apresentar as condições completas antes de você decidir?"$script$,true,2),
('SIAPE','SIAPE',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidinho?"

MOTIVO
"Estou entrando em contato para verificar possibilidades de crédito para servidor federal do SIAPE. Primeiro fazemos uma simulação, sem garantia de aprovação."

QUALIFICAÇÃO
"Você já possui consignado ou cartão consignado? Está procurando valor novo, reduzir parcela ou conhecer as possibilidades?"

FECHAMENTO
"Posso consultar as opções disponíveis e te mostrar valor, parcela, prazo e condições para você analisar?"$script$,true,3),
('Consignado Privado','Consignado Privado',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"

MOTIVO
"Atendemos soluções de crédito para trabalhadores de empresas privadas. Quero verificar se existe alguma opção disponível para o seu perfil, conforme as regras da modalidade e da instituição."

QUALIFICAÇÃO
"Você trabalha atualmente com carteira assinada? Está procurando crédito novo, organizar parcelas ou apenas conhecer as condições?"

FECHAMENTO
"Posso fazer uma simulação e te mostrar as condições antes de qualquer contratação?"$script$,true,4),
('CLT','CLT',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"

MOTIVO
"Estou entrando em contato sobre o Crédito do Trabalhador para quem trabalha com carteira assinada. Quero verificar se existe alguma opção disponível para o seu perfil, conforme as regras vigentes."

QUALIFICAÇÃO
"Você está trabalhando atualmente com carteira assinada? Está buscando um valor novo ou quer conhecer as condições?"

FECHAMENTO
"Posso fazer a simulação e apresentar valor, parcela, prazo e condições para você analisar?"$script$,true,5),
('FGTS','FGTS',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidinho sobre uma possibilidade relacionada ao seu FGTS?"

MOTIVO
"Quero verificar se existe uma opção de antecipação do saque-aniversário do FGTS disponível para você, conforme as regras e a análise da instituição."

QUALIFICAÇÃO
"Você utiliza o saque-aniversário? Já fez alguma antecipação anteriormente?"

FECHAMENTO
"Posso verificar as condições e te apresentar valor, taxas, prazo e demais informações para você analisar antes de contratar?"$script$,true,6),
('Crédito Pessoal','Crédito Pessoal',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso explicar rapidamente o motivo da ligação?"

MOTIVO
"Trabalhamos com opções de crédito pessoal sujeitas à análise. Quero entender o que você precisa e verificar se existe alguma condição compatível com o seu perfil."

QUALIFICAÇÃO
"Você está buscando um valor específico ou quer comparar opções de parcela e prazo?"

FECHAMENTO
"Posso fazer uma simulação e te mostrar as condições para você comparar com calma?"$script$,true,7),
('Cartão Consignado','Cartão Consignado',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidinho sobre uma opção de cartão consignado?"

MOTIVO
"Quero verificar se existe uma opção disponível para o seu perfil e explicar limite, descontos, custos e demais condições antes de qualquer contratação."

QUALIFICAÇÃO
"Você já possui cartão consignado? Está procurando uma nova opção ou quer entender como funciona?"

FECHAMENTO
"Se houver elegibilidade, eu apresento as condições completas para você avaliar antes de decidir."$script$,true,8),
('Cartão Benefício','Cartão Benefício',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso explicar rapidamente uma opção de cartão benefício?"

MOTIVO
"Quero verificar se existe uma opção disponível para o seu perfil e explicar como funcionam descontos, custos, limite e demais condições aplicáveis."

QUALIFICAÇÃO
"Você já possui algum cartão benefício ou está conhecendo essa modalidade agora?"

FECHAMENTO
"Posso consultar a elegibilidade e apresentar as condições antes de você tomar qualquer decisão?"$script$,true,9),
('Seguros','Seguros',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"

MOTIVO
"Também trabalhamos com soluções de proteção, como assistência médica, residencial e funeral. Quero entender se alguma delas pode fazer sentido para você."

QUALIFICAÇÃO
"Hoje você procura proteção para sua saúde, residência, família ou quer conhecer as opções disponíveis?"

FECHAMENTO
"Se tiver interesse, eu apresento cobertura, preço e condições para você avaliar antes de contratar."$script$,true,10),
('Energia Solar','Energia Solar',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso te explicar uma alternativa para sua conta de energia?"

MOTIVO
"Temos uma solução de energia por assinatura/parceria que pode reduzir o custo da conta, conforme disponibilidade e regras da oferta."

QUALIFICAÇÃO
"Você gostaria de verificar uma alternativa para economizar na conta de energia sem instalar placas no imóvel?"

FECHAMENTO
"Posso verificar a disponibilidade e te apresentar a economia estimada e as condições antes de você decidir?"$script$,true,11),
('Abertura de conta Santander','Abertura de conta Santander',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidinho?"

MOTIVO
"Nós também fazemos indicação para abertura de conta Santander. Quero saber se você tem interesse em conhecer as condições e benefícios informados pela instituição."

QUALIFICAÇÃO
"Você já possui conta Santander ou teria interesse em conhecer a opção?"

FECHAMENTO
"Se tiver interesse, eu te explico o processo e as condições para você avaliar com calma."$script$,true,12),
('Crédito com Imóvel em Garantia','Crédito com Imóvel em Garantia',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidamente sobre uma possibilidade de crédito?"

MOTIVO
"Quero verificar se uma operação de crédito com imóvel em garantia pode ser compatível com seu objetivo, sempre sujeita à análise da instituição."

QUALIFICAÇÃO
"Você possui um imóvel e está buscando recursos para reorganizar dívidas, investir ou realizar algum projeto?"

FECHAMENTO
"Posso fazer uma análise inicial e apresentar as condições, custos, prazo e garantias para você avaliar?"$script$,true,13),
('Crédito com Veículo em Garantia','Crédito com Veículo em Garantia',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidamente sobre uma possibilidade de crédito?"

MOTIVO
"Quero verificar se uma operação de crédito com veículo em garantia pode ser compatível com seu objetivo, sempre sujeita à análise da instituição."

QUALIFICAÇÃO
"Você possui um veículo que poderia ser considerado na análise? Está buscando recursos para alguma necessidade específica?"

FECHAMENTO
"Posso verificar as possibilidades e apresentar valor, custos, prazo e condições para você analisar antes de decidir?"$script$,true,14),
('BPC/LOAS','BPC/LOAS',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso explicar rapidamente o motivo da ligação?"

MOTIVO
"Quero verificar se existe alguma solução financeira compatível com seu benefício e com as regras atuais. Primeiro fazemos a análise; não é promessa de aprovação."

QUALIFICAÇÃO
"Você já possui algum contrato ou cartão relacionado ao benefício? Está procurando um valor novo ou quer conhecer as possibilidades?"

FECHAMENTO
"Se houver uma opção adequada, eu apresento as condições completas para você avaliar sem compromisso."$script$,true,15),
('Atendimento','Atendimento',$script$ABERTURA
"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"

MOTIVO
"Estou entrando em contato para entender se existe alguma solução financeira que faça sentido para você. Faço algumas perguntas rápidas e, se houver uma opção, explico as condições."

QUALIFICAÇÃO
"Você está buscando um valor novo, reduzir parcela ou apenas conhecer as possibilidades?"

FECHAMENTO
"Se fizer sentido, seguimos com a simulação. Se não fizer, sem problema."$script$,true,99)
on conflict (chave) do nothing;