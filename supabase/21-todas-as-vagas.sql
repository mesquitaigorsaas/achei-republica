-- =====================================================================
-- Achei República — o painel passa a ver TODAS as vagas
--
-- Rode DEPOIS do 20-plano-no-painel.sql.
--
-- ---------------------------------------------------------------------
-- O QUE FALTAVA
--
-- O painel só enxergava vaga por exceção: a que a triagem separou, ou a
-- que alguém denunciou. Não havia lugar nenhum para simplesmente olhar
-- o que está anunciado no site. Para procurar corretor disfarçado, que
-- é o trabalho de verdade, isso não serve: quem passou pela triagem sem
-- disparar nenhuma regra some da vista para sempre.
--
-- ---------------------------------------------------------------------
-- POR QUE UMA FUNÇÃO, SE A RLS JÁ DEIXA
--
-- O 11 deu ao administrador uma regra de leitura sobre republicas, então
-- em tese a página poderia consultar a tabela direto. Duas razões para
-- não fazer isso.
--
-- A primeira é o dono. O nome e o telefone de quem anuncia estão em
-- perfis, e republicas.dono_id aponta para auth.users, não para perfis
-- — o PostgREST não tem por onde juntar as duas sozinho.
--
-- A segunda é o costume da casa: as outras três listas do painel já são
-- funções que conferem sou_admin() na primeira linha. Uma consulta solta
-- seria a única porta com fechadura diferente.
--
-- ---------------------------------------------------------------------
-- O TIPO VEM JUNTO, E É O CAMPO QUE IMPORTA
--
-- Corretor não aluga cama nem lugar em quarto compartilhado. Ele anuncia
-- imóvel inteiro. Então "apartamento" e "casa" são o filtro que separa
-- quem vive disso de quem tem uma vaga sobrando em casa — sem acusar
-- ninguém, porque apartamento inteiro para três estudantes dividirem
-- também existe e é legítimo.
-- =====================================================================

create or replace function admin_vagas()
returns table (
    id uuid, nome text, tipo text, perfil text,
    status text, ativa boolean,
    cidade text, bairro text,
    preco numeric, vagas integer,
    anunciante text, email text, telefone text, relacao text,
    destaque text, destaque_ate timestamptz,
    denuncias bigint,
    criada_em timestamptz
)
language sql stable security definer set search_path = public
as $$
    select r.id, r.nome, r.tipo, r.perfil,
           r.status, r.ativa,
           c.nome, r.bairro,
           r.preco, r.vagas,
           p.nome, u.email::text, p.telefone, p.relacao,
           r.destaque, r.destaque_ate,
           (select count(*) from denuncias d where d.republica_id = r.id),
           r.criada_em
      from republicas r
      join perfis p on p.id = r.dono_id
      join auth.users u on u.id = r.dono_id
      left join cidades c on c.id = r.cidade_id
     where sou_admin()
     order by r.criada_em desc;
$$;

grant execute on function admin_vagas() to authenticated;


-- =====================================================================
-- CONFERIR
--
-- Logado como administrador, no SQL Editor:
--
--   select nome, tipo, status, ativa, anunciante from admin_vagas();
--
-- Tem que voltar TODA vaga do site, inclusive as fora do ar e as
-- recusadas. Se voltar vazio, ou a sua conta não está marcada como
-- admin, ou o 11 não rodou.
--
-- O atalho para procurar imobiliária, direto no SQL:
--
--   select nome, cidade, anunciante, telefone, preco
--     from admin_vagas()
--    where tipo in ('apartamento', 'casa')
--    order by preco desc;
-- =====================================================================
