-- =====================================================================
-- Achei República — o administrador, e o vazamento das duas views
--
-- Rode DEPOIS do 10-um-anuncio-por-conta.sql.
--
-- Duas coisas, e a segunda é urgente.
--
-- 1. O site passa a saber quem é você, para existir uma área de
--    administração de verdade.
--
-- 2. CONSERTA UM VAZAMENTO. As views anunciantes (do 10) e
--    fila_de_revisao (do 04) mostram e-mail e telefone de todo mundo, e
--    hoje qualquer conta logada consegue lê-las.
--
-- NÃO EXISTE SENHA NESTE ARQUIVO, e não deve existir em nenhum. Você
-- entra no painel com a mesma conta e a mesma senha que já usa no site;
-- o que este arquivo faz é marcar aquela conta como administradora.
-- Senha escrita aqui ficaria em texto puro num repositório público.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Quem é administrador
--
-- Uma coluna, marcada à mão por você. Não há tela para virar
-- administrador, e é de propósito: a única forma de alguém virar um é
-- você abrindo o Supabase e escrevendo.
-- ---------------------------------------------------------------------
alter table perfis add column if not exists admin boolean not null default false;

comment on column perfis.admin is
    'Marcado a mao no Supabase. Da acesso ao painel e a leitura de tudo.';

/* A pergunta "quem está pedindo é administrador?" precisa ler a tabela
   perfis — que tem RLS dizendo que cada um só lê o próprio. Uma regra
   que chamasse esta função para decidir quem lê perfis entraria em
   recursão.

   SECURITY DEFINER resolve: a função roda com os direitos de quem a
   criou e não passa pela RLS. Ela devolve só sim ou não, sobre quem
   está pedindo — não serve para descobrir nada sobre ninguém. */
create or replace function sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select p.admin from perfis p where p.id = auth.uid()), false);
$$;

grant execute on function sou_admin() to authenticated;


-- ---------------------------------------------------------------------
-- 2. O VAZAMENTO
--
-- No Postgres, uma view roda com os direitos de QUEM A CRIOU, e não de
-- quem a consulta. Como as duas foram criadas por você (postgres), elas
-- passam por cima da RLS das tabelas de baixo. E o Supabase, por padrão,
-- libera select no schema public para anon e authenticated.
--
-- Junte as duas coisas: qualquer pessoa com conta no site conseguia
-- baixar a lista inteira de anunciantes, com e-mail e telefone.
--
-- A saída NÃO é security_invoker. Tentei, e não serve: as duas views
-- leem auth.users, e a conta comum não tem permissão nessa tabela — a
-- view morreria com "permission denied" até para você.
--
-- A saída é fechar as views e servir os mesmos dados por FUNÇÃO. Função
-- SECURITY DEFINER passa por cima da RLS de propósito, e a primeira
-- coisa que ela faz é conferir sou_admin(). Quem não é administrador
-- recebe zero linha — não um erro, zero linha.
-- ---------------------------------------------------------------------
revoke all on anunciantes     from anon, authenticated;
revoke all on fila_de_revisao from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. O que o administrador enxerga nas tabelas
--
-- Cada regra é um "ou": somam-se às que já existem, não as substituem.
-- O anunciante comum continua vendo exatamente o que via.
-- ---------------------------------------------------------------------

drop policy if exists perfis_admin_le on perfis;
create policy perfis_admin_le on perfis
    for select using (sou_admin());

drop policy if exists perfis_admin_edita on perfis;
create policy perfis_admin_edita on perfis
    for update using (sou_admin()) with check (sou_admin());

drop policy if exists republicas_admin_le on republicas;
create policy republicas_admin_le on republicas
    for select using (sou_admin());

drop policy if exists republicas_admin_edita on republicas;
create policy republicas_admin_edita on republicas
    for update using (sou_admin()) with check (sou_admin());

-- A tabela de denúncias nasceu sem NENHUMA regra de leitura, de
-- propósito — assim ninguém descobre pelo site quem denunciou o quê. O
-- administrador passa a ler; continua sendo o único.
drop policy if exists denuncias_admin_le on denuncias;
create policy denuncias_admin_le on denuncias
    for select using (sou_admin());


-- ---------------------------------------------------------------------
-- 4. A trava que impedia VOCÊ de aprovar
--
-- O gatilho triar_republica(), do 04-anunciante.sql, desfaz qualquer
-- mudança de status feita por quem vem do navegador — foi o que impediu
-- o próprio dono de aprovar o anúncio dele.
--
-- Só que o painel também vem do navegador. Sem esta correção, clicar em
-- "liberar" não faria nada: o gatilho devolveria o status anterior, sem
-- erro nenhum, e o anúncio continuaria na fila.
--
-- A função vai inteira porque CREATE OR REPLACE precisa do corpo
-- completo. O que mudou é uma linha: "and not sou_admin()".
-- ---------------------------------------------------------------------
create or replace function triar_republica()
returns trigger language plpgsql as $$
declare
    quantas integer;
    texto   text;
begin
    if tg_op = 'UPDATE'
       and new.status is distinct from old.status
       and coalesce(auth.role(), 'postgres') = 'authenticated'
       and not sou_admin() then
        new.status := old.status;
    end if;

    if tg_op = 'INSERT'
       or new.nome is distinct from old.nome
       or new.descricao is distinct from old.descricao then

        select count(*) into quantas
          from republicas r
         where r.dono_id in (select contas_do_mesmo_anunciante(new.dono_id))
           and r.id <> new.id
           and r.ativa;

        texto := coalesce(new.nome, '') || ' ' || coalesce(new.descricao, '');

        if quantas >= 2 or palavras_de_corretor(texto) then
            new.status := 'em_revisao';
        end if;
    end if;

    return new;
end $$;


-- ---------------------------------------------------------------------
-- 5. As três listas do painel
--
-- Funções e não views, pelo motivo do item 2. Todas conferem
-- sou_admin() na primeira linha do WHERE: para quem não é, a consulta
-- devolve vazio.
-- ---------------------------------------------------------------------

create or replace function admin_fila_de_revisao()
returns table (
    id uuid, nome text, descricao text, criada_em timestamptz,
    cidade text, anunciante text, telefone text, relacao text,
    anuncios_da_pessoa bigint, denuncias bigint
)
language sql stable security definer set search_path = public
as $$
    select r.id, r.nome, r.descricao, r.criada_em,
           c.nome, p.nome, p.telefone, p.relacao,
           (select count(*) from republicas o
             where o.dono_id in (select contas_do_mesmo_anunciante(r.dono_id))),
           (select count(*) from denuncias d where d.republica_id = r.id)
      from republicas r
      join perfis p on p.id = r.dono_id
      left join cidades c on c.id = r.cidade_id
     where sou_admin()
       and r.status = 'em_revisao'
     order by r.criada_em;
$$;

create or replace function admin_denuncias()
returns table (
    id uuid, motivo text, detalhe text, criada_em timestamptz,
    republica_id uuid, republica text, status text, ativa boolean,
    cidade text, anunciante text, telefone text
)
language sql stable security definer set search_path = public
as $$
    select d.id, d.motivo, d.detalhe, d.criada_em,
           r.id, r.nome, r.status, r.ativa,
           c.nome, p.nome, p.telefone
      from denuncias d
      join republicas r on r.id = d.republica_id
      join perfis p on p.id = r.dono_id
      left join cidades c on c.id = r.cidade_id
     where sou_admin()
     order by d.criada_em desc;
$$;

create or replace function admin_anunciantes()
returns table (
    id uuid, email text, nome text, telefone text, relacao text,
    limite_anuncios integer, bloqueado boolean, admin boolean,
    anuncios_no_ar bigint, anuncios_no_total bigint, denuncias bigint,
    criado_em timestamptz
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
           p.criado_em
      from perfis p
      join auth.users u on u.id = p.id
     where sou_admin()
     order by p.criado_em desc;
$$;

grant execute on function admin_fila_de_revisao() to authenticated;
grant execute on function admin_denuncias()       to authenticated;
grant execute on function admin_anunciantes()     to authenticated;


-- =====================================================================
-- AGORA MARQUE A SUA CONTA
--
-- Troque pelo e-mail com que você entra no site. É a mesma conta e a
-- mesma senha de sempre — este comando só acende a chave.
--
--   update perfis set admin = true
--    where id = (select id from auth.users where email = 'SEU@EMAIL.COM');
--
-- Confira que pegou (tem que voltar uma linha, com admin = true):
--
--   select u.email, p.nome, p.admin
--     from perfis p join auth.users u on u.id = p.id
--    where p.admin;
--
-- Se voltar vazio, o e-mail não bate com nenhuma conta — confira a
-- grafia em Authentication → Users.
-- =====================================================================
