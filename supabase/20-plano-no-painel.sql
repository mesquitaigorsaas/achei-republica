-- =====================================================================
-- Achei República — o painel passa a dizer qual é o plano da vaga
--
-- Rode DEPOIS do 19-telefone-so-digitos.sql.
--
-- ---------------------------------------------------------------------
-- POR QUE FALTAVA
--
-- As funções do painel nasceram no 11-painel-do-administrador.sql, e o
-- destaque pago só chegou no 12-destaque-da-vaga.sql. Ninguém voltou
-- para incluir. O resultado é que a fila de revisão e a lista de
-- denúncias mostram a vaga sem dizer se ela é Grátis, Destaque ou
-- Premium — que é justamente o que muda o peso da decisão. Recusar uma
-- vaga que alguém pagou para destacar não é o mesmo que recusar uma
-- gratuita, e hoje as duas são iguais na tela.
--
-- ---------------------------------------------------------------------
-- POR QUE DUAS COLUNAS, E NÃO UMA
--
-- Vão junto o destaque e a data em que ele acaba. Só o nome do plano
-- mentiria: uma vaga com destaque VENCIDO ainda tem 'premium' gravado
-- na coluna, e ela é gratuita hoje na busca. Quem decide é a data, e
-- quem compara é o site, com a hora de agora — mesma regra do
-- destaqueValendo() do js/planos.js.
--
-- ---------------------------------------------------------------------
-- POR QUE DROP ANTES DO CREATE
--
-- "create or replace" não muda a assinatura de retorno de uma função
-- que já existe: acrescentar coluna ao "returns table" dá
-- "cannot change return type of existing function". Tem que derrubar e
-- refazer — e refazer inclui devolver o grant, que some junto.
--
-- Enquanto este arquivo não roda, o painel não mente: a etiqueta de
-- plano simplesmente não aparece. O js confere se o campo veio antes
-- de escrever qualquer coisa.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A fila de revisão
-- ---------------------------------------------------------------------
drop function if exists admin_fila_de_revisao();

create or replace function admin_fila_de_revisao()
returns table (
    id uuid, nome text, descricao text, criada_em timestamptz,
    cidade text, anunciante text, telefone text, relacao text,
    anuncios_da_pessoa bigint, denuncias bigint,
    destaque text, destaque_ate timestamptz
)
language sql stable security definer set search_path = public
as $$
    select r.id, r.nome, r.descricao, r.criada_em,
           c.nome, p.nome, p.telefone, p.relacao,
           (select count(*) from republicas o
             where o.dono_id in (select contas_do_mesmo_anunciante(r.dono_id))),
           (select count(*) from denuncias d where d.republica_id = r.id),
           r.destaque, r.destaque_ate
      from republicas r
      join perfis p on p.id = r.dono_id
      left join cidades c on c.id = r.cidade_id
     where sou_admin()
       and r.status = 'em_revisao'
     order by r.criada_em;
$$;


-- ---------------------------------------------------------------------
-- As denúncias
-- ---------------------------------------------------------------------
drop function if exists admin_denuncias();

create or replace function admin_denuncias()
returns table (
    id uuid, motivo text, detalhe text, criada_em timestamptz,
    republica_id uuid, republica text, status text, ativa boolean,
    cidade text, anunciante text, telefone text,
    destaque text, destaque_ate timestamptz
)
language sql stable security definer set search_path = public
as $$
    select d.id, d.motivo, d.detalhe, d.criada_em,
           r.id, r.nome, r.status, r.ativa,
           c.nome, p.nome, p.telefone,
           r.destaque, r.destaque_ate
      from denuncias d
      join republicas r on r.id = d.republica_id
      join perfis p on p.id = r.dono_id
      left join cidades c on c.id = r.cidade_id
     where sou_admin()
     order by d.criada_em desc;
$$;


-- ---------------------------------------------------------------------
-- O grant volta, porque o drop levou junto
-- ---------------------------------------------------------------------
grant execute on function admin_fila_de_revisao() to authenticated;
grant execute on function admin_denuncias()       to authenticated;


-- =====================================================================
-- CONFERIR
--
-- Logado como administrador, no SQL Editor:
--
--   select nome, destaque, destaque_ate from admin_fila_de_revisao();
--   select republica, destaque, destaque_ate from admin_denuncias();
--
-- Colunas vazias com a fila vazia é o esperado. O que importa é as
-- duas colunas EXISTIREM: se der "column destaque does not exist", o
-- drop/create não rodou.
-- =====================================================================
