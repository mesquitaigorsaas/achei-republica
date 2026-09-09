-- =====================================================================
-- Achei República — o painel passa a mostrar o endereço do anunciante
--
-- Rode DEPOIS do 21-todas-as-vagas.sql.
--
-- ---------------------------------------------------------------------
-- POR QUE
--
-- O endereço é obrigatório no cadastro desde o 04-anunciante.sql, e é
-- ele que a triagem usa para agrupar contas parecidas: mesmo endereço
-- até o complemento provavelmente é a mesma pessoa com duas contas.
--
-- Só que quem decide nunca viu esse endereço. A função do painel nasceu
-- sem ele, então a tela mostra o telefone e o e-mail e esconde
-- justamente o campo que separa dois moradores da mesma casa (dois
-- anunciantes legítimos) de uma pessoa com duas contas.
--
-- ---------------------------------------------------------------------
-- DROP ANTES DO CREATE, DE NOVO
--
-- Mesma história do 20: acrescentar coluna ao "returns table" é mudar a
-- assinatura, e "create or replace" recusa. Derruba, refaz, devolve o
-- grant.
--
-- Enquanto este arquivo não roda, a linha do endereço simplesmente não
-- aparece. O js confere se o campo veio.
-- =====================================================================

drop function if exists admin_anunciantes();

create or replace function admin_anunciantes()
returns table (
    id uuid, email text, nome text, telefone text, relacao text,
    limite_anuncios integer, bloqueado boolean, admin boolean,
    anuncios_no_ar bigint, anuncios_no_total bigint, denuncias bigint,
    criado_em timestamptz,
    cep text, logradouro text, numero text, complemento text,
    bairro text, cidade text, uf text
)
language sql stable security definer set search_path = public
as $$
    select p.id, u.email::text, p.nome, p.telefone, p.relacao,
           p.limite_anuncios, p.bloqueado, p.admin,
           (select count(*) from republicas r where r.dono_id = p.id and r.ativa),
           (select count(*) from republicas r where r.dono_id = p.id),
           (select count(*) from denuncias d
              join republicas r on r.id = d.republica_id
             where r.dono_id = p.id),
           p.criado_em,
           p.cep, p.logradouro, p.numero, p.complemento,
           p.bairro, p.cidade, p.uf
      from perfis p
      join auth.users u on u.id = p.id
     where sou_admin()
     order by p.criado_em desc;
$$;

grant execute on function admin_anunciantes() to authenticated;


-- =====================================================================
-- CONFERIR
--
-- Logado como administrador:
--
--   select nome, logradouro, numero, bairro, cidade, uf
--     from admin_anunciantes();
--
-- Conta antiga pode voltar com endereço vazio, e não é erro: os campos
-- de endereço só passaram a ser exigidos no 04, e quem se cadastrou
-- antes disso não tem.
--
-- O atalho para achar duas contas no mesmo endereço:
--
--   select cep, numero, complemento, count(*), array_agg(email)
--     from admin_anunciantes()
--    where cep is not null and cep <> ''
--    group by cep, numero, complemento
--   having count(*) > 1;
-- =====================================================================
