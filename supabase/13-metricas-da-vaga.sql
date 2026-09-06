-- =====================================================================
-- Achei República — o que aconteceu com a vaga
--
-- Rode DEPOIS do 12-destaque-da-vaga.sql.
--
-- Quem paga R$ 39,90 vai perguntar, com toda razão, o que ganhou com
-- isso. Sem número, a resposta é "confia". Este arquivo é o que permite
-- responder "sua vaga apareceu 240 vezes, foi aberta 31 e 9 pessoas
-- clicaram no seu WhatsApp".
--
-- ---------------------------------------------------------------------
-- O QUE ESTA TABELA NÃO GUARDA, E POR QUÊ
-- ---------------------------------------------------------------------
--
-- Não guarda IP, não guarda identificador de visitante, não guarda quem
-- viu o quê. Guarda CONTAGEM: vaga, dia, tipo de evento, de onde veio.
--
-- Não é escrúpulo decorativo. Um estudante que abre três repúblicas na
-- mesma noite não deve ficar rastreável pelo dono de nenhuma delas — e
-- a LGPD trata IP como dado pessoal. Contagem agregada não é dado
-- pessoal, e responde a pergunta comercial inteira do mesmo jeito.
--
-- ---------------------------------------------------------------------
-- E O NÚMERO É CONFIÁVEL?
-- ---------------------------------------------------------------------
--
-- Confiável para decidir, não auditável para cobrar. Qualquer pessoa
-- com o código-fonte na mão pode chamar a função de registro num laço e
-- inflar a contagem de uma vaga. Vale saber disso e vale relativizar:
--
--   - inflar a PRÓPRIA vaga só engana a si mesmo;
--   - inflar a vaga alheia não dá vantagem a ninguém;
--   - e o dedo no dado é caro justamente quando o número vira preço.
--
-- A defesa proporcional está aqui: a função só aceita tipos conhecidos,
-- no máximo 60 eventos por chamada, e o site deduplica por sessão —
-- recarregar a página não conta visita nova. Se um dia a contagem virar
-- base de cobrança, aí sim entra assinatura de evento no servidor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A CONTAGEM
--
-- Uma linha por (vaga, dia, tipo, origem), somando. Trinta dias de uma
-- vaga cabem em algumas dezenas de linhas — e não em milhares, que é o
-- que aconteceria guardando evento a evento.
--
-- OS TIPOS
--   vitrine — a vaga APARECEU numa lista de resultados
--   visita  — alguém abriu a página da vaga
--   contato — alguém clicou no WhatsApp
--
-- AS ORIGENS
--   vitrine  — a lista da home, sem filtro nem questionário
--   filtro   — passou pelo painel de filtros completos
--   match    — veio do questionário de compatibilidade
--   direto   — link aberto de fora, ou endereço digitado
--
-- A origem é o que responde a pergunta que interessa ao anunciante:
-- "quantos estudantes chegaram até mim pelos filtros?" — e é ela que
-- separa exposição de curiosidade.
-- ---------------------------------------------------------------------
create table if not exists metricas_da_vaga (
    republica_id uuid not null references republicas(id) on delete cascade,
    dia          date not null default current_date,
    tipo         text not null check (tipo in ('vitrine', 'visita', 'contato')),
    origem       text not null default 'direto'
                 check (origem in ('vitrine', 'filtro', 'match', 'direto')),
    quantas      integer not null default 0 check (quantas >= 0),

    primary key (republica_id, dia, tipo, origem)
);

create index if not exists idx_metricas_dia on metricas_da_vaga(republica_id, dia desc);

comment on table metricas_da_vaga is
    'Contagem agregada por vaga/dia/tipo/origem. Sem IP, sem identificador de visitante: nao guarda quem, guarda quantos.';


-- ---------------------------------------------------------------------
-- Registrar
--
-- Recebe um lote: a home mostra doze cartões de uma vez, e doze
-- chamadas separadas seriam doze viagens ao servidor para escrever doze
-- números. O site junta e manda uma vez só.
--
-- O formato é [{"id": "uuid", "tipo": "vitrine", "origem": "filtro"}].
--
-- SECURITY DEFINER porque a tabela não tem policy de insert para
-- ninguém: quem escreve é esta função, que valida o que entra. Sem ela,
-- liberar insert direto significaria deixar qualquer um escrever
-- qualquer número em qualquer linha, inclusive negativo.
--
-- Vaga que não existe é ignorada em silêncio (o join com republicas
-- descarta), e não vira erro: um cartão apagado no meio da navegação
-- não deve derrubar o registro dos outros onze.
-- ---------------------------------------------------------------------
create or replace function registrar_metricas(eventos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if eventos is null or jsonb_typeof(eventos) <> 'array' then
        return;
    end if;

    -- Teto por chamada. Não protege de um laço determinado, protege de
    -- um envio malformado gigante e do erro de programação que manda a
    -- lista inteira do banco.
    if jsonb_array_length(eventos) > 60 then
        raise exception 'LOTE_GRANDE_DEMAIS: no maximo 60 eventos por chamada.';
    end if;

    insert into metricas_da_vaga (republica_id, dia, tipo, origem, quantas)
    select r.id,
           current_date,
           e.tipo,
           e.origem,
           1
      from jsonb_to_recordset(eventos) as e(id uuid, tipo text, origem text)
      join republicas r on r.id = e.id
     where e.tipo   in ('vitrine', 'visita', 'contato')
       and coalesce(e.origem, 'direto') in ('vitrine', 'filtro', 'match', 'direto')
    on conflict (republica_id, dia, tipo, origem)
    do update set quantas = metricas_da_vaga.quantas + 1;
end $$;

/* Aberta para quem não tem conta, de propósito: a maior parte das
   visitas ao anúncio vem de gente que nunca vai criar conta nenhuma.
   Exigir login aqui mediria só o anunciante olhando o próprio anúncio. */
grant execute on function registrar_metricas(jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Ler os próprios números
--
-- O dono lê os da vaga dele; você lê os de qualquer uma. O visitante
-- não lê nenhum — a contagem é informação comercial do anunciante, e
-- não parte do anúncio.
-- ---------------------------------------------------------------------
alter table metricas_da_vaga enable row level security;

drop policy if exists metricas_le_o_dono on metricas_da_vaga;
create policy metricas_le_o_dono on metricas_da_vaga
    for select using (
        sou_admin()
        or exists (select 1 from republicas r
                    where r.id = metricas_da_vaga.republica_id
                      and r.dono_id = auth.uid())
    );


-- ---------------------------------------------------------------------
-- O resumo que o painel mostra
--
-- Três recortes na mesma chamada, porque são as três perguntas que a
-- pessoa faz na mesma respirada:
--
--   sempre       — desde que o anúncio existe
--   trinta_dias  — o mês corrente de exposição
--   na_promocao  — só o período pago, que é o que responde "valeu a
--                  pena?". Nulo quando nunca houve promoção.
--
-- Repare que não há gate de plano aqui. Os números são do anunciante,
-- e cobrar para ele ver o que é dele seria feio. O que o plano muda é o
-- DETALHE que o painel desenha: o grátis vê os totais, o pago vê a
-- quebra por origem e o dia a dia.
-- ---------------------------------------------------------------------
create or replace function resumo_da_vaga(alvo uuid)
returns table (
    janela   text,
    tipo     text,
    origem   text,
    quantas  bigint
)
language sql
stable
security definer
set search_path = public
as $$
    with permitido as (
        select 1
         where sou_admin()
            or exists (select 1 from republicas r
                        where r.id = alvo and r.dono_id = auth.uid())
    ),
    promo as (
        select comeca_em, termina_em
          from promocoes
         where republica_id = alvo
           and status in ('ativa', 'expirada')
         order by comeca_em desc nulls last
         limit 1
    ),
    linhas as (
        select m.* from metricas_da_vaga m, permitido
         where m.republica_id = alvo
    )
    select 'sempre', tipo, origem, sum(quantas) from linhas group by tipo, origem
    union all
    select 'trinta_dias', tipo, origem, sum(quantas) from linhas
     where dia >= current_date - 29 group by tipo, origem
    union all
    select 'na_promocao', l.tipo, l.origem, sum(l.quantas)
      from linhas l, promo p
     where p.comeca_em is not null
       and l.dia between p.comeca_em::date and coalesce(p.termina_em, now())::date
     group by l.tipo, l.origem;
$$;

grant execute on function resumo_da_vaga(uuid) to authenticated;


-- =====================================================================
-- A DEMANDA — a arquitetura, sem a tela
--
-- O enunciado pede para PREPARAR o terreno de "18 estudantes estão
-- procurando uma vaga parecida com a sua", sem construir a tela agora.
-- Isto é o terreno.
--
-- O dado já existe e hoje é jogado fora: o questionário da home coleta
-- cidade, faculdade, curso, teto de preço, tempo de trajeto e jeito de
-- morar, calcula a compatibilidade na hora e esquece tudo quando a
-- pessoa fecha a aba.
--
-- Guardar isso é o que transforma "acho que tem gente procurando" em
-- "sete pessoas procuraram até R$ 700 em Alfenas este mês". É também a
-- única informação com a qual dá para ir a uma república e dizer por
-- que vale a pena anunciar — e ela vem de graça, do que já é digitado.
--
-- SEM DONO. A tabela não tem coluna de usuário, e é decisão de projeto:
-- resposta de questionário ligada a pessoa é perfil de comportamento;
-- desligada, é pesquisa de mercado. A segunda responde a pergunta
-- comercial inteira e não cria um dado que eu teria que proteger.
--
-- Ninguém lê pelo site — nem o anunciante. A tela que um dia mostrar
-- "18 estudantes procuram" vai ler de uma FUNÇÃO que devolve contagem
-- com piso (nunca "1 estudante procura", que identificaria a pessoa
-- para quem estava conversando com ela ontem).
-- =====================================================================
create table if not exists buscas (
    id           uuid primary key default gen_random_uuid(),
    criada_em    timestamptz not null default now(),

    cidade       text,
    faculdade    text,
    curso        text,
    -- Teto de preço em reais, como a pessoa respondeu.
    teto         integer,
    -- Minutos de trajeto que ela aceita.
    tempo        integer,
    -- 'silencioso', 'pet', 'individual'... os mesmos apelidos do
    -- js/marcas.js, para poder cruzar com republica_marcas depois.
    jeito        text[]
);

create index if not exists idx_buscas_cidade on buscas(cidade, criada_em desc);

comment on table buscas is
    'Respostas do questionario, SEM dono. Pesquisa de mercado agregada, nao perfil de pessoa.';

alter table buscas enable row level security;

/* Escrita por função, como as métricas: sem policy de insert, e a
   função valida. Leitura, ninguém — nem o dono da vaga. Só o SQL
   Editor, que não passa por RLS, até existir a função de contagem. */
create or replace function registrar_busca(
    p_cidade    text,
    p_faculdade text,
    p_curso     text,
    p_teto      integer,
    p_tempo     integer,
    p_jeito     text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Sem cidade não há pergunta comercial nenhuma a responder.
    if coalesce(trim(p_cidade), '') = '' then
        return;
    end if;

    insert into buscas (cidade, faculdade, curso, teto, tempo, jeito)
    values (
        left(trim(p_cidade), 60),
        left(trim(coalesce(p_faculdade, '')), 60),
        left(trim(coalesce(p_curso, '')), 60),
        case when p_teto between 0 and 100000 then p_teto end,
        case when p_tempo between 0 and 600 then p_tempo end,
        p_jeito[1:10]
    );
end $$;

grant execute on function registrar_busca(text, text, text, integer, integer, text[]) to anon, authenticated;


-- =====================================================================
-- PARA CONFERIR DEPOIS DE RODAR
--
-- 1. Registrar um evento à mão e ver a contagem subir:
--
--      select registrar_metricas(
--          jsonb_build_array(
--              jsonb_build_object('id', (select id from republicas limit 1),
--                                 'tipo', 'visita', 'origem', 'direto')));
--
--      select * from metricas_da_vaga;
--
--    Rodar duas vezes deve deixar quantas = 2, e não duas linhas.
--
-- 2. Que a validação segura lixo:
--
--      select registrar_metricas('[{"id":"00000000-0000-0000-0000-000000000000",
--                                   "tipo":"inventado","origem":"x"}]'::jsonb);
--
--    Não deve inserir nada, e não deve dar erro.
--
-- 3. O resumo, logado como o dono da vaga:
--
--      select * from resumo_da_vaga('O-ID-DA-VAGA');
--
-- 4. E que o vizinho NÃO lê os números alheios: logado com outra conta,
--    a mesma chamada deve voltar vazia.
--
--    Para limpar os testes:
--
--      delete from metricas_da_vaga;
-- =====================================================================
