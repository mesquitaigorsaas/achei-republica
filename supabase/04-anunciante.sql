-- =====================================================================
-- Achei República — conta do anunciante e barreira contra imobiliária
--
-- Rode DEPOIS do 02-seguranca.sql.
--
-- O que este arquivo resolve: o cadastro guarda os dados da pessoa, e
-- o sistema passa a distinguir quem tem uma vaga de quem tem quinze.
--
-- Não existe jeito de DETECTAR um corretor. Sem CPF nem CNPJ não há
-- documento para cruzar com o CRECI, e qualquer pergunta que a gente
-- faça, ele pode responder mentindo. O que dá para fazer é encarecer o
-- volume: uma conta por WhatsApp, dois anúncios publicando direto, e
-- do terceiro em diante espera revisão. Dono de uma casa nunca esbarra
-- nisso. Quem vive de anunciar, esbarra na primeira semana.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfis: dados completos da pessoa
--
-- O endereço aqui é o DA PESSOA, não o da república. O endereço da
-- casa é perguntado no anúncio, porque uma pessoa pode anunciar uma
-- vaga em endereço diferente de onde ela mora.
-- ---------------------------------------------------------------------
alter table perfis add column if not exists cep         text;
alter table perfis add column if not exists logradouro  text;
alter table perfis add column if not exists numero      text;
alter table perfis add column if not exists complemento text;
alter table perfis add column if not exists bairro      text;
alter table perfis add column if not exists cidade      text;
alter table perfis add column if not exists uf          text;

-- Relação com a casa. Note que não existe opção "corretor": quem é,
-- ou desiste aqui, ou marca uma opção falsa — e aí a remoção depois
-- tem base, em vez de parecer perseguição.
alter table perfis add column if not exists relacao text
    check (relacao in ('moro', 'dono', 'responsavel'));

-- Quando a pessoa aceitou a regra de que anúncio é de quem tem relação
-- direta com a casa. É o que dá terreno firme para tirar o anúncio.
alter table perfis add column if not exists aceitou_regras_em timestamptz;

-- Marcado por você, à mão, quando um caso se confirma.
alter table perfis add column if not exists bloqueado boolean not null default false;

-- ---------------------------------------------------------------------
-- Um WhatsApp, uma conta
--
-- É a trava mais barata que existe contra a conta descartável: abrir
-- e-mail é de graça, conseguir número novo não é. Guardamos o telefone
-- como a pessoa digitou, mas comparamos só os dígitos — senão
-- (35) 99999-9999 e 35999999999 passariam como dois cadastros.
-- ---------------------------------------------------------------------
create or replace function so_digitos(t text)
returns text language sql immutable as $$
    select regexp_replace(coalesce(t, ''), '\D', '', 'g');
$$;

create unique index if not exists idx_perfis_telefone
    on perfis (so_digitos(telefone))
    where telefone is not null and telefone <> '';

-- ---------------------------------------------------------------------
-- Situação do anúncio
--
-- 'publicada'  — aparece na busca
-- 'em_revisao' — só o dono enxerga, esperando você olhar
-- 'recusada'   — você olhou e não era vaga de estudante
-- ---------------------------------------------------------------------
alter table republicas add column if not exists status text not null default 'publicada'
    check (status in ('publicada', 'em_revisao', 'recusada'));

create index if not exists idx_republicas_revisao on republicas(criada_em)
    where status = 'em_revisao';

-- ---------------------------------------------------------------------
-- A mesma pessoa, em contas diferentes
--
-- O telefone único impede repetir o número, mas não impede o corretor
-- de abrir três contas com três chips e anunciar uma casa em cada.
-- Contar anúncios por conta deixaria as três passando direto.
--
-- Então contamos por PESSOA: contas que dividem o mesmo nome, ou o
-- mesmo endereço até o complemento, valem como uma só na hora da
-- triagem.
--
-- Vai ter falso positivo — dois moradores da mesma casa anunciando
-- vagas diferentes caem juntos. Isso é aceitável porque a triagem não
-- recusa nada: manda para a fila. O custo do engano é você olhar e
-- liberar, não o anúncio honesto morrer.
-- ---------------------------------------------------------------------

-- Nome comparável: sem acento, sem pontuação, sem espaço dobrado.
-- Sem isto, "João Paulo" e "Joao  paulo" seriam duas pessoas.
create or replace function so_texto(t text)
returns text language sql immutable as $$
    select trim(regexp_replace(
        regexp_replace(
            lower(translate(coalesce(t, ''),
                'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
            '[^a-z0-9 ]', '', 'g'),
        '\s+', ' ', 'g'));
$$;

create or replace function contas_do_mesmo_anunciante(alvo uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $funcao$
    select p.id
      from perfis p, perfis eu
     where eu.id = alvo
       and (
            (so_texto(p.nome) <> '' and so_texto(p.nome) = so_texto(eu.nome))
         or (so_digitos(p.cep) <> ''
             and so_digitos(p.cep)  = so_digitos(eu.cep)
             and so_texto(p.numero) = so_texto(eu.numero)
             and so_texto(coalesce(p.complemento, '')) = so_texto(coalesce(eu.complemento, '')))
       );
$funcao$;

-- As marcas do ofício. Não bloqueiam nada sozinhas — mandam para a
-- fila, porque "ref. 12" também aparece em anúncio honesto.
create or replace function palavras_de_corretor(t text)
returns boolean language sql immutable as $$
    select coalesce(t, '') ~* '(creci|imobili[áa]ri|corretor|corretagem|agende\s+sua\s+visita|c[óo]d(igo)?\.?\s*\d|ref\.?\s*\d{2,}|taxa\s+de\s+intermedia)';
$$;

-- ---------------------------------------------------------------------
-- Triagem
--
-- Faz três coisas, nesta ordem:
--   1. impede que o próprio dono aprove o anúncio dele;
--   2. manda para revisão do terceiro anúncio ativo em diante;
--   3. manda para revisão quando o texto tem cara de imobiliária.
--
-- Roda também no update: se a pessoa publica um anúncio limpo e depois
-- edita a descrição para virar propaganda de imobiliária, cai na fila
-- do mesmo jeito.
-- ---------------------------------------------------------------------
create or replace function triar_republica()
returns trigger language plpgsql as $$
declare
    quantas integer;
    texto   text;
begin
    -- 1. Só você muda a situação. Pelo site, a coluna é intocável.
    --    auth.role() é 'authenticated' para quem vem do navegador e
    --    outra coisa para o painel do Supabase, que é onde você aprova.
    if tg_op = 'UPDATE'
       and new.status is distinct from old.status
       and coalesce(auth.role(), 'postgres') = 'authenticated' then
        new.status := old.status;
    end if;

    -- 2 e 3. Só reavalia quando o texto entra ou muda — assim aprovar
    --        um anúncio não o joga de volta na fila.
    if tg_op = 'INSERT'
       or new.nome is distinct from old.nome
       or new.descricao is distinct from old.descricao then

        -- Conta os anúncios de todas as contas da mesma pessoa, e não
        -- só os desta. Três contas com um anúncio cada não passam mais
        -- por baixo do limite.
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

drop trigger if exists trg_republicas_triagem on republicas;
create trigger trg_republicas_triagem
    before insert or update on republicas
    for each row execute function triar_republica();

-- ---------------------------------------------------------------------
-- Quem está bloqueado não anuncia mais
-- ---------------------------------------------------------------------
create or replace function perfil_liberado()
returns boolean language sql stable as $$
    select not coalesce((select p.bloqueado from perfis p where p.id = auth.uid()), false);
$$;

drop policy if exists republicas_cria on republicas;
create policy republicas_cria on republicas
    for insert with check (auth.uid() = dono_id and perfil_liberado());

-- ---------------------------------------------------------------------
-- Leitura: anúncio em revisão não aparece na busca
--
-- Refaz a regra do 02-seguranca.sql acrescentando o status. O dono
-- continua enxergando o próprio, senão ele acharia que sumiu.
-- ---------------------------------------------------------------------
drop policy if exists republicas_leitura on republicas;
create policy republicas_leitura on republicas
    for select using ((ativa and status = 'publicada') or auth.uid() = dono_id);

create or replace function republica_visivel(alvo uuid)
returns boolean language sql security invoker stable as $$
    select exists (
        select 1 from republicas r
        where r.id = alvo
          and ((r.ativa and r.status = 'publicada') or r.dono_id = auth.uid())
    );
$$;

-- ---------------------------------------------------------------------
-- Denúncias
--
-- O estudante é quem reconhece um anúncio de imobiliária — ele já viu
-- o mesmo texto em três sites. Qualquer visitante pode denunciar, sem
-- login, porque exigir conta para denunciar mata a denúncia. Ninguém
-- lê essa tabela pelo site: não existe policy de select, então ela só
-- se abre no painel do Supabase.
-- ---------------------------------------------------------------------
create table if not exists denuncias (
    id           uuid primary key default gen_random_uuid(),
    republica_id uuid not null references republicas(id) on delete cascade,
    autor_id     uuid references auth.users(id) on delete set null,
    motivo       text not null
                 check (motivo in ('imobiliaria', 'golpe', 'anuncio_falso', 'ja_alugada', 'outro')),
    detalhe      text,
    criada_em    timestamptz not null default now()
);

create index if not exists idx_denuncias_republica on denuncias(republica_id);

alter table denuncias enable row level security;

drop policy if exists denuncias_cria on denuncias;
create policy denuncias_cria on denuncias
    for insert with check (true);

-- ---------------------------------------------------------------------
-- Sua fila de trabalho
--
-- Abra no painel do Supabase: é a lista do que espera decisão, com o
-- telefone da pessoa e quantos anúncios ela já tem.
-- ---------------------------------------------------------------------
create or replace view fila_de_revisao as
    select r.id,
           r.nome,
           r.descricao,
           r.criada_em,
           p.nome            as anunciante,
           p.telefone,
           p.relacao,
           (select count(*) from republicas o where o.dono_id = r.dono_id) as anuncios_da_conta,
           -- Somando as outras contas da mesma pessoa: é este número que
           -- entrega o corretor que abriu três cadastros.
           (select count(*) from republicas o
             where o.dono_id in (select contas_do_mesmo_anunciante(r.dono_id))) as anuncios_da_pessoa,
           (select count(*) from denuncias d where d.republica_id = r.id)  as denuncias
      from republicas r
      join perfis p on p.id = r.dono_id
     where r.status = 'em_revisao'
     order by r.criada_em;

-- ---------------------------------------------------------------------
-- O perfil nasce junto com a conta
--
-- Mesmo desenho do Comércio Alfenas: no cadastro, o site manda nome,
-- telefone, endereço e relação com a casa dentro do próprio signUp, e
-- este gatilho monta o perfil na mesma hora.
--
-- Faz diferença porque quando a confirmação de e-mail está ligada, o
-- cadastro termina SEM sessão aberta. Se o perfil dependesse de um
-- insert feito pela página, ele nunca seria criado — as regras de
-- segurança exigem estar logado, e ninguém está.
--
-- Se algo estiver errado (telefone repetido), o cadastro inteiro é
-- desfeito: não fica conta de login órfã, sem perfil.
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil_do_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $funcao$
begin
    insert into public.perfis (
        id, nome, telefone, tipo, relacao, aceitou_regras_em,
        cep, logradouro, numero, complemento, bairro, cidade, uf
    )
    values (
        new.id,
        trim(new.raw_user_meta_data ->> 'nome'),
        trim(new.raw_user_meta_data ->> 'telefone'),
        'anunciante',
        nullif(trim(coalesce(new.raw_user_meta_data ->> 'relacao', '')), ''),
        case when (new.raw_user_meta_data ->> 'aceitou_regras') = 'true'
             then now() else null end,
        regexp_replace(coalesce(new.raw_user_meta_data ->> 'cep', ''), '\D', '', 'g'),
        trim(new.raw_user_meta_data ->> 'logradouro'),
        trim(new.raw_user_meta_data ->> 'numero'),
        nullif(trim(coalesce(new.raw_user_meta_data ->> 'complemento', '')), ''),
        trim(new.raw_user_meta_data ->> 'bairro'),
        trim(new.raw_user_meta_data ->> 'cidade'),
        upper(trim(new.raw_user_meta_data ->> 'uf'))
    );

    return new;
end;
$funcao$;

drop trigger if exists trg_criar_perfil on auth.users;
create trigger trg_criar_perfil
    after insert on auth.users
    for each row execute function public.criar_perfil_do_novo_usuario();

-- ---------------------------------------------------------------------
-- Avisar antes, não depois
--
-- Telefone repetido faria o cadastro morrer com "Database error saving
-- new user", que não diz nada para quem está preenchendo. Esta função
-- deixa a tela perguntar antes de enviar.
--
-- Ela responde só sim ou não. Não devolve nome nem e-mail de ninguém —
-- de propósito, porque qualquer um pode chamá-la e ela não pode virar
-- uma forma de descobrir quem tem conta no site a partir de um número.
-- ---------------------------------------------------------------------
create or replace function public.telefone_ja_cadastrado(p_telefone text)
returns boolean
language sql
security definer
set search_path = public
as $funcao$
    select exists (
        select 1
          from public.perfis
         where so_digitos(telefone) = so_digitos(p_telefone)
           and so_digitos(p_telefone) <> ''
    );
$funcao$;

grant execute on function public.telefone_ja_cadastrado(text) to anon, authenticated;
