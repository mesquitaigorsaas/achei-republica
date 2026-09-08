-- =====================================================================
-- Achei República — o destaque pago de UMA vaga
--
-- Rode DEPOIS do 11-painel-do-administrador.sql.
--
-- O que este arquivo cria: a república continua anunciando de graça, e
-- pode pagar UMA VEZ para que UMA vaga apareça com mais evidência
-- durante até 30 dias. Não é assinatura, não renova sozinho, não é
-- mensalidade, e não vale para a próxima vaga — cada promoção fica
-- amarrada à linha de republicas que foi paga.
--
-- ---------------------------------------------------------------------
-- TRÊS DECISÕES QUE EXPLICAM O DESENHO INTEIRO
-- ---------------------------------------------------------------------
--
-- 1. O PREÇO MORA AQUI, E NÃO NA PÁGINA.
--
--    A chave pública do Supabase está no código-fonte do site. Se o
--    valor cobrado viesse do navegador, alguém trocaria 3990 por 1 e
--    compraria o Premium por um centavo. A função que cria a cobrança
--    recebe só o APELIDO do plano e vem buscar o preço nesta tabela.
--    O navegador nunca diz quanto custa; ele pergunta.
--
-- 2. O NÍVEL DE DESTAQUE NÃO É ESCRITO — É CALCULADO.
--
--    O dono tem update liberado na própria linha de republicas (é o que
--    permite editar o anúncio). Se "destaque" fosse uma coluna comum,
--    qualquer anunciante viraria Pro de graça com três linhas no console
--    do navegador. Então as três colunas de destaque são DERIVADAS: um
--    gatilho as recalcula a partir da tabela de promoções a cada
--    gravação, e joga fora o que veio de fora. Escrever nelas não dá
--    erro; simplesmente não tem efeito.
--
-- 3. O DESTAQUE EXPIRA SOZINHO, POR CONSTRUÇÃO.
--
--    Nada depende de uma tarefa noturna rodar. A promoção guarda
--    "termina_em", e todo lugar que decide se há destaque compara com
--    now(). Se nenhuma rotina rodar nunca, o destaque para de valer no
--    segundo exato mesmo assim. A função expirar_promocoes() lá embaixo
--    existe só para ARRUMAR O RÓTULO — trocar 'ativa' por 'expirada' na
--    listagem — e não para desligar coisa nenhuma.
-- =====================================================================


-- ---------------------------------------------------------------------
-- OS PLANOS
--
-- Tabela e não lista no código, por dois motivos: é a autoridade sobre
-- o preço (decisão 1), e mudar de R$ 19,90 para R$ 24,90 vira um update
-- em vez de um deploy.
--
-- O preço é INTEIRO, em centavos. Dinheiro em numeric funcionaria, mas
-- centavo inteiro é o que o Mercado Pago espera e o que não acumula
-- resto de divisão.
--
-- "peso" é o que ordena a vitrine: 0 para quem não pagou, 3 para o Pro.
-- Repare que ele NÃO é o preço — a ordenação não deve mudar sozinha no
-- dia em que um preço for reajustado.
-- ---------------------------------------------------------------------
create table if not exists planos (
    slug            text primary key
                    check (slug in ('gratuito', 'destaque', 'premium', 'pro')),
    nome            text not null,
    preco_centavos  integer not null check (preco_centavos >= 0),
    dias            integer not null default 30 check (dias between 1 and 90),
    peso            integer not null default 0 check (peso between 0 and 9),
    selo            text,
    chamada         text,
    ordem           integer not null,
    ativo           boolean not null default true
);

comment on table planos is
    'Catalogo de planos. E a autoridade sobre o preco: a funcao de pagamento le daqui, nunca do navegador.';

-- Os valores aqui são os de uma instalação NOVA. Premium e Pro nasceram
-- 3990 e 6990 e foram reajustados pelo 15-precos-de-setembro.sql, quando
-- saíram dos planos as promessas que o site não cumpria. Para mudar
-- preço num banco que já existe, use um arquivo pequeno como o 15 — não
-- este, que também cria as funções sensíveis.
insert into planos (slug, nome, preco_centavos, dias, peso, selo, chamada, ordem) values
    ('gratuito', 'Grátis',   0,    30, 0, null, 'Estar na plataforma',       1),
    ('destaque', 'Destaque', 1990, 30, 1, '⭐', 'Aumentar a visibilidade',   2),
    ('premium',  'Premium',  2990, 30, 2, '🔥', 'Mais exposição + recursos', 3),
    ('pro',      'Pro',      4990, 30, 3, '👑', 'Máxima exposição',          4)
on conflict (slug) do update
    set nome = excluded.nome,
        preco_centavos = excluded.preco_centavos,
        dias = excluded.dias,
        peso = excluded.peso,
        selo = excluded.selo,
        chamada = excluded.chamada,
        ordem = excluded.ordem;


-- ---------------------------------------------------------------------
-- AS PROMOÇÕES
--
-- Uma linha por contratação. Amarrada à VAGA (republica_id), e não ao
-- anunciante — é o que faz o plano não vazar para a próxima vaga.
--
-- Por que preco_centavos e dias são copiados para cá, se já estão em
-- planos: porque o recibo de uma compra de setembro não pode mudar
-- quando o preço de outubro mudar. O que foi cobrado é o que está
-- escrito aqui.
--
-- dono_id fica guardado mesmo sendo derivável de republicas: se a vaga
-- for apagada, o histórico de quem pagou o quê continua de pé.
--
-- OS ESTADOS
--   aguardando — cobrança criada, dinheiro não chegou. Não destaca nada.
--   ativa      — pago e valendo, até termina_em.
--   expirada   — passou de termina_em. Só um rótulo (veja a decisão 3).
--   cancelada  — você desfez, com o motivo escrito.
--   recusada   — o pagamento não foi aprovado.
-- ---------------------------------------------------------------------
create table if not exists promocoes (
    id              uuid primary key default gen_random_uuid(),
    republica_id    uuid not null references republicas(id) on delete cascade,
    dono_id         uuid not null references auth.users(id) on delete cascade,

    plano           text not null references planos(slug),
    preco_centavos  integer not null check (preco_centavos >= 0),
    dias            integer not null check (dias between 1 and 90),

    status          text not null default 'aguardando'
                    check (status in ('aguardando','ativa','expirada','cancelada','recusada')),

    criada_em       timestamptz not null default now(),
    -- Nulos até o dinheiro entrar. O relógio começa a correr no
    -- pagamento, e não na escolha do plano: quem escolheu na terça e
    -- pagou na quinta não perde dois dias.
    comeca_em       timestamptz,
    termina_em      timestamptz,

    observacao      text
);

create index if not exists idx_promocoes_republica on promocoes(republica_id);
create index if not exists idx_promocoes_dono      on promocoes(dono_id);
create index if not exists idx_promocoes_vigentes  on promocoes(termina_em)
    where status = 'ativa';

comment on table promocoes is
    'Contratacao de destaque, amarrada a UMA vaga. Pagamento unico: nao renova, nao vira assinatura.';

/* Uma vaga não pode ter duas promoções valendo ao mesmo tempo. Sem
   isto, dois cliques seguidos no botão de pagar viram duas cobranças
   pela mesma coisa — e o segundo pagamento não compra nada, porque o
   destaque já estava aceso.

   O índice é parcial: só olha as ativas. Promoção encerrada em julho
   não impede uma nova em setembro. */
create unique index if not exists idx_promocao_ativa_unica
    on promocoes (republica_id)
    where status = 'ativa';


-- ---------------------------------------------------------------------
-- OS PAGAMENTOS
--
-- Separado de promoções de propósito: uma tentativa recusada e a
-- tentativa seguinte aprovada são dois pagamentos da mesma promoção. Se
-- fosse tudo numa linha só, a primeira sumiria — e é justamente a que
-- você vai querer ver quando alguém disser "paguei e não acendeu".
--
-- "bruto" guarda a resposta inteira do provedor. Ocupa espaço e vale a
-- pena: é a única prova do que o Mercado Pago realmente respondeu, no
-- dia em que a conversa for sobre dinheiro.
-- ---------------------------------------------------------------------
create table if not exists pagamentos (
    id               uuid primary key default gen_random_uuid(),
    promocao_id      uuid not null references promocoes(id) on delete cascade,

    provedor         text not null default 'mercado_pago',
    -- O id do pagamento lá do lado deles. Único: é o que impede a mesma
    -- notificação, reenviada, virar dois registros.
    referencia       text,
    valor_centavos   integer not null check (valor_centavos >= 0),

    status           text not null default 'criado'
                     check (status in ('criado','pendente','aprovado','recusado','estornado','cancelado')),
    metodo           text,
    bruto            jsonb,

    criado_em        timestamptz not null default now(),
    atualizada_em    timestamptz not null default now()
);

create unique index if not exists idx_pagamento_referencia
    on pagamentos (provedor, referencia)
    where referencia is not null;

create index if not exists idx_pagamentos_promocao on pagamentos(promocao_id);

/* A coluna se chama atualizada_em, e não atualizado_em, porque a função
   tocar_atualizada_em() do 01-esquema.sql escreve nesse nome. Reusar a
   função já existente é melhor que uma segunda quase igual. */
drop trigger if exists trg_pagamentos_atualizado on pagamentos;
create trigger trg_pagamentos_atualizado
    before update on pagamentos
    for each row execute function tocar_atualizada_em();


-- ---------------------------------------------------------------------
-- AS TRÊS COLUNAS DERIVADAS
--
-- Ficam em republicas para que a vitrine continue fazendo UMA consulta
-- só. Sem elas, cada cartão precisaria de uma segunda busca, ou a
-- tabela de promoções teria que ficar legível para visitante anônimo.
--
-- Não são fonte de verdade: são cópia calculada. Quem manda é promocoes.
-- ---------------------------------------------------------------------
alter table republicas add column if not exists destaque      text references planos(slug);
alter table republicas add column if not exists destaque_peso integer not null default 0;
alter table republicas add column if not exists destaque_ate  timestamptz;

comment on column republicas.destaque is
    'DERIVADA de promocoes por gatilho. Escrever aqui nao tem efeito: e recalculada em toda gravacao.';

create index if not exists idx_republicas_destaque
    on republicas (destaque_peso desc, criada_em desc)
    where ativa and status = 'publicada';


-- ---------------------------------------------------------------------
-- Qual promoção está valendo para uma vaga, agora
--
-- "agora" é levado a sério: a comparação com now() é o que faz o
-- destaque expirar sem tarefa nenhuma.
--
-- Se por algum motivo houver duas ativas, ganha a de maior peso. É
-- defensivo — o índice único acima não deveria deixar acontecer.
-- ---------------------------------------------------------------------
create or replace function destaque_vigente(alvo uuid)
returns table (plano text, peso integer, ate timestamptz)
language sql
stable
security definer
set search_path = public
as $$
    select pr.plano, pl.peso, pr.termina_em
      from promocoes pr
      join planos pl on pl.slug = pr.plano
     where pr.republica_id = alvo
       and pr.status = 'ativa'
       and pr.termina_em > now()
     order by pl.peso desc, pr.termina_em desc
     limit 1;
$$;

revoke all on function destaque_vigente(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- O gatilho que recalcula — e que, de quebra, é a tranca
--
-- Ele roda em TODA gravação de republicas e reescreve as três colunas a
-- partir da tabela de promoções. Não existe "if veio do navegador":
-- o que veio é descartado sempre, porque o valor certo é recalculado
-- sempre. Uma tranca que não depende de adivinhar quem está batendo.
--
-- A vaga fora do ar não exibe destaque. Isso é o "marquei como
-- preenchida" do enunciado: o destaque apaga na hora.
--
-- E ele NÃO encerra a promoção — só para de mostrá-la. Quem tirou do ar
-- na segunda porque achou que alugou, e voltou na quarta porque o
-- combinado caiu, encontra o destaque de volta, valendo até a data que
-- pagou. O contrário seria queimar dias comprados por causa de um
-- clique honesto.
-- ---------------------------------------------------------------------
create or replace function sincronizar_destaque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    vigente record;
begin
    select * into vigente from destaque_vigente(new.id);

    if new.ativa and new.status = 'publicada' and vigente.plano is not null then
        new.destaque      := vigente.plano;
        new.destaque_peso := vigente.peso;
        new.destaque_ate  := vigente.ate;
    else
        new.destaque      := null;
        new.destaque_peso := 0;
        new.destaque_ate  := null;
    end if;

    return new;
end $$;

drop trigger if exists trg_republicas_destaque on republicas;
create trigger trg_republicas_destaque
    before insert or update on republicas
    for each row execute function sincronizar_destaque();


-- ---------------------------------------------------------------------
-- Quando a promoção muda, a vaga precisa saber
--
-- O gatilho de cima só roda quando republicas é gravada. Pagar não
-- grava republicas — grava promocoes. Este aqui fecha o circuito com um
-- update de nada (só toca atualizada_em), que faz o de cima recalcular.
--
-- Não há risco de laço: o gatilho de republicas não escreve em
-- promocoes.
-- ---------------------------------------------------------------------
create or replace function refletir_promocao_na_vaga()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update republicas
       set atualizada_em = now()
     where id = coalesce(new.republica_id, old.republica_id);
    return null;
end $$;

drop trigger if exists trg_promocoes_refletem on promocoes;
create trigger trg_promocoes_refletem
    after insert or update or delete on promocoes
    for each row execute function refletir_promocao_na_vaga();


-- ---------------------------------------------------------------------
-- Acender o destaque — o único caminho
--
-- Chamada pela função de borda (Edge Function) DEPOIS de ela ter
-- perguntado ao Mercado Pago, com a chave secreta, se aquele pagamento
-- foi mesmo aprovado. Nunca porque o navegador disse que pagou.
--
-- Só a service_role executa. Está revogada de anon e authenticated
-- logo abaixo: se um dia alguém apontar o navegador para cá, recebe
-- "permission denied" e não um destaque de graça.
--
-- Idempotente de propósito: o Mercado Pago reenvia a mesma notificação
-- quando não recebe 200 na primeira. Chamar duas vezes não empilha 60
-- dias — a segunda chamada devolve a promoção como ela já está.
-- ---------------------------------------------------------------------
create or replace function ativar_promocao(
    p_promocao   uuid,
    p_referencia text,
    p_metodo     text default null,
    p_bruto      jsonb default null
)
returns promocoes
language plpgsql
security definer
set search_path = public
as $$
declare
    promo promocoes;
begin
    select * into promo from promocoes where id = p_promocao for update;

    if promo.id is null then
        raise exception 'PROMOCAO_INEXISTENTE: %', p_promocao;
    end if;

    -- Já estava acesa: nada a fazer, e devolver o que existe é o que
    -- faz a segunda notificação ser inofensiva.
    if promo.status = 'ativa' then
        update pagamentos
           set status = 'aprovado',
               metodo = coalesce(p_metodo, metodo),
               bruto  = coalesce(p_bruto, bruto)
         where promocao_id = p_promocao
           and referencia  = p_referencia;
        return promo;
    end if;

    update promocoes
       set status     = 'ativa',
           comeca_em  = now(),
           termina_em = now() + (promo.dias || ' days')::interval
     where id = p_promocao
    returning * into promo;

    update pagamentos
       set status = 'aprovado',
           metodo = coalesce(p_metodo, metodo),
           bruto  = coalesce(p_bruto, bruto)
     where promocao_id = p_promocao
       and (referencia = p_referencia or referencia is null);

    return promo;
end $$;

revoke all on function ativar_promocao(uuid, text, text, jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Registrar que o pagamento não foi aprovado
--
-- Também só pela função de borda. Existe para a pessoa ver "recusado"
-- no painel em vez de um "aguardando" eterno que não explica nada.
-- ---------------------------------------------------------------------
create or replace function recusar_promocao(
    p_promocao   uuid,
    p_referencia text,
    p_situacao   text,
    p_bruto      jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Promoção já ativa não volta atrás por notificação atrasada: uma
    -- mensagem de "pendente" que chega depois da de "aprovado" não pode
    -- apagar o destaque de quem pagou.
    update promocoes
       set status = 'recusada'
     where id = p_promocao
       and status = 'aguardando';

    update pagamentos
       set status = case p_situacao
                        when 'rejected'  then 'recusado'
                        when 'cancelled' then 'cancelado'
                        when 'refunded'  then 'estornado'
                        when 'charged_back' then 'estornado'
                        else 'pendente'
                    end,
           bruto = coalesce(p_bruto, bruto)
     where promocao_id = p_promocao
       and (referencia = p_referencia or referencia is null);
end $$;

revoke all on function recusar_promocao(uuid, text, text, jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Arrumar o rótulo das que já venceram
--
-- Repetindo, porque é a parte que parece frágil e não é: isto NÃO
-- desliga destaque nenhum. O destaque já está desligado desde o segundo
-- em que termina_em passou, porque tudo compara com now(). Esta função
-- existe para a listagem do painel não mostrar "ativa" em algo que
-- acabou ontem.
--
-- Pode rodar por pg_cron, pelo painel de administração, ou nunca.
-- ---------------------------------------------------------------------
create or replace function expirar_promocoes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    quantas integer;
begin
    with vencidas as (
        update promocoes
           set status = 'expirada'
         where status = 'ativa'
           and termina_em <= now()
        returning id
    )
    select count(*) into quantas from vencidas;

    return quantas;
end $$;

revoke all on function expirar_promocoes() from public, anon, authenticated;
grant execute on function expirar_promocoes() to authenticated;


-- ---------------------------------------------------------------------
-- QUEM LÊ O QUÊ
--
-- planos     — todo mundo, inclusive quem não tem conta. É a tabela de
--              preços; escondê-la seria escondê-la de quem vai pagar.
-- promocoes  — o dono da vaga e você. Ninguém escreve pelo site.
-- pagamentos — idem. Repare que NÃO existe policy de insert, update ou
--              delete em nenhuma das duas: toda escrita passa pela
--              função de borda, com a chave secreta, ou por você.
-- ---------------------------------------------------------------------
alter table planos     enable row level security;
alter table promocoes  enable row level security;
alter table pagamentos enable row level security;

drop policy if exists planos_leitura on planos;
create policy planos_leitura on planos
    for select using (true);

drop policy if exists promocoes_le_o_dono on promocoes;
create policy promocoes_le_o_dono on promocoes
    for select using (auth.uid() = dono_id or sou_admin());

drop policy if exists pagamentos_le_o_dono on pagamentos;
create policy pagamentos_le_o_dono on pagamentos
    for select using (
        sou_admin()
        or exists (select 1 from promocoes p
                    where p.id = pagamentos.promocao_id
                      and p.dono_id = auth.uid())
    );


-- ---------------------------------------------------------------------
-- A lista do painel de administração
--
-- Mesmo motivo do 11: função e não view, porque view roda com os
-- direitos de quem a criou e escaparia da RLS. A primeira linha do
-- where é sou_admin() — para quem não é, volta vazio.
-- ---------------------------------------------------------------------
create or replace function admin_promocoes()
returns table (
    id uuid, plano text, status text, preco_centavos integer,
    criada_em timestamptz, comeca_em timestamptz, termina_em timestamptz,
    republica_id uuid, republica text, vaga_no_ar boolean,
    anunciante text, telefone text,
    pagamento text, referencia text, metodo text
)
language sql stable security definer set search_path = public
as $$
    select pr.id, pr.plano, pr.status, pr.preco_centavos,
           pr.criada_em, pr.comeca_em, pr.termina_em,
           r.id, r.nome, (r.ativa and r.status = 'publicada'),
           p.nome, p.telefone,
           pg.status, pg.referencia, pg.metodo
      from promocoes pr
      join republicas r on r.id = pr.republica_id
      join perfis p     on p.id = pr.dono_id
      left join lateral (
          select status, referencia, metodo
            from pagamentos
           where promocao_id = pr.id
           order by criado_em desc
           limit 1
      ) pg on true
     where sou_admin()
     order by pr.criada_em desc;
$$;

grant execute on function admin_promocoes() to authenticated;


-- ---------------------------------------------------------------------
-- Cancelar uma promoção — só você
--
-- Existe para o caso feio: estorno, cobrança em duplicidade, anúncio
-- que se revelou de imobiliária depois de pago. Guarda o motivo escrito,
-- porque cancelamento sem motivo vira discussão daqui a três meses.
-- ---------------------------------------------------------------------
create or replace function admin_cancelar_promocao(p_promocao uuid, p_motivo text)
returns promocoes
language plpgsql
security definer
set search_path = public
as $$
declare
    promo promocoes;
begin
    if not sou_admin() then
        raise exception 'SO_ADMIN: esta funcao e do painel de administracao.';
    end if;

    update promocoes
       set status = 'cancelada',
           observacao = coalesce(nullif(trim(p_motivo), ''), 'sem motivo escrito')
     where id = p_promocao
    returning * into promo;

    return promo;
end $$;

grant execute on function admin_cancelar_promocao(uuid, text) to authenticated;


-- =====================================================================
-- PARA CONFERIR DEPOIS DE RODAR
--
-- 1. Os quatro planos, com o preço em reais:
--
--      select slug, nome, preco_centavos / 100.0 as reais, dias, peso
--        from planos order by ordem;
--
-- 2. As colunas derivadas nasceram vazias, como devem:
--
--      select nome, destaque, destaque_peso, destaque_ate from republicas;
--
-- 3. A TRANCA. Entre no site com uma conta comum, abra o console do
--    navegador e tente virar Pro de graça:
--
--      await banco.from('republicas')
--                 .update({ destaque: 'pro', destaque_peso: 3 })
--                 .eq('id', 'O-ID-DA-SUA-VAGA');
--
--    Não deve dar erro — e não deve mudar nada. Confira com a consulta
--    do item 2: destaque continua nulo e destaque_peso continua 0.
--    Se mudou, PARE e me chame: o gatilho não entrou.
--
-- 4. Acender à mão, para ver a vitrine com destaque antes de o pagamento
--    existir (rode no SQL Editor, que não passa pela RLS):
--
--      insert into promocoes (republica_id, dono_id, plano, preco_centavos, dias,
--                             status, comeca_em, termina_em, observacao)
--      select r.id, r.dono_id, 'premium', 3990, 30,
--             'ativa', now(), now() + interval '30 days', 'teste'
--        from republicas r where r.ativa limit 1;
--
--    E conferir que a coluna derivada acendeu sozinha:
--
--      select nome, destaque, destaque_peso, destaque_ate from republicas;
--
-- 5. Que "vaga preenchida" apaga o destaque na hora:
--
--      update republicas set ativa = false where destaque is not null;
--      select nome, ativa, destaque from republicas;   -- destaque nulo
--      update republicas set ativa = true  where id = 'AQUELE-ID';
--      select nome, ativa, destaque from republicas;   -- destaque de volta
--
--    Para limpar o teste:
--
--      delete from promocoes where observacao = 'teste';
-- =====================================================================
