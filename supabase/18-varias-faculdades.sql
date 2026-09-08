-- =====================================================================
-- Achei República — uma vaga pode estar perto de até três faculdades
--
-- Em Alfenas, uma casa ficava perto da UNIFAL e pronto. Em Belo
-- Horizonte, uma casa no Coração Eucarístico está perto da PUC CE E do
-- CEFET Nova Suíça, e obrigar o anunciante a escolher uma delas joga
-- fora metade dos estudantes que ela serve.
--
-- ---------------------------------------------------------------------
-- POR QUE O "minutos" TEM DE VIR JUNTO
--
-- Hoje minutos é uma coluna da república: um número só. Com duas
-- faculdades, "20 minutos" não quer dizer nada sem dizer de qual — e o
-- trajeto é METADE da nota de compatibilidade. Por isso o tempo mora
-- aqui, uma linha por faculdade, e não lá.
--
-- ---------------------------------------------------------------------
-- TRÊS, E O MOTIVO DO LIMITE
--
-- Não é economia de espaço. Quem marca oito faculdades está dizendo
-- "estou perto de tudo", que é o mesmo que não dizer nada — e vira o
-- jeito mais fácil de aparecer em toda busca sem pagar destaque. Três
-- cobre o caso real (a casa entre dois ou três campi) e não vira
-- carteirada.
--
-- Quem faz valer é um gatilho, e não uma constraint: contar linhas de
-- outra tabela é coisa que check constraint não faz. Mesmo remédio do
-- 10-um-anuncio-por-conta.sql.
--
-- ---------------------------------------------------------------------
-- AS COLUNAS VELHAS FICAM. DE PROPÓSITO.
--
-- republicas.faculdade_id e republicas.minutos continuam existindo e
-- continuam preenchidas. Apagar agora quebraria o site no segundo em
-- que este arquivo rodasse, porque o código no ar ainda pede as duas —
-- foi exatamente assim que a coluna foto_url derrubou a consulta
-- inteira dos classificados uma vez.
--
-- A ordem segura é: (1) este arquivo, (2) publicar o código que lê a
-- tabela nova, (3) só então um arquivo pequeno apagando as colunas. O
-- passo 3 fica anotado no fim.
-- =====================================================================

create table if not exists republica_faculdades (
    republica_id uuid    not null references republicas(id)  on delete cascade,
    faculdade_id uuid    not null references faculdades(id)  on delete cascade,
    -- Nulo é resposta: "é perto, mas não sei quantos minutos". Melhor
    -- que forçar um número inventado, que estragaria a ordenação.
    minutos      integer check (minutos is null or minutos between 0 and 240),
    primary key (republica_id, faculdade_id)
);

create index if not exists idx_rep_fac_faculdade on republica_faculdades(faculdade_id);

comment on table republica_faculdades is
    'De quais faculdades a vaga esta perto, e quantos minutos de cada uma. Ate 3 por vaga.';


-- ---------------------------------------------------------------------
-- O que já existe é copiado para cá
--
-- Idempotente pelo on conflict: rodar duas vezes não duplica nem
-- sobrescreve um tempo que o anunciante já tenha corrigido depois.
-- ---------------------------------------------------------------------
insert into republica_faculdades (republica_id, faculdade_id, minutos)
select r.id, r.faculdade_id, r.minutos
from republicas r
where r.faculdade_id is not null
on conflict (republica_id, faculdade_id) do nothing;


-- ---------------------------------------------------------------------
-- O teto de três
-- ---------------------------------------------------------------------
create or replace function limite_de_faculdades()
returns trigger language plpgsql as $$
declare
    quantas integer;
begin
    select count(*) into quantas
    from republica_faculdades
    where republica_id = new.republica_id;

    -- Conta ANTES da linha nova entrar, então o teto é 3 quando já há 3.
    if quantas >= 3 then
        raise exception 'LIMITE_DE_FACULDADES: uma vaga pode indicar no maximo 3 faculdades';
    end if;

    return new;
end $$;

revoke all on function limite_de_faculdades() from public, anon, authenticated;

drop trigger if exists tg_limite_de_faculdades on republica_faculdades;
create trigger tg_limite_de_faculdades
    before insert on republica_faculdades
    for each row execute function limite_de_faculdades();


-- ---------------------------------------------------------------------
-- Quem pode ler e escrever
--
-- Exatamente o mesmo desenho das outras tabelas filhas: lê quem pode ver
-- a república, escreve só o dono dela. As duas funções já existem, do
-- 02-seguranca.sql.
-- ---------------------------------------------------------------------
alter table republica_faculdades enable row level security;

drop policy if exists republica_faculdades_leitura on republica_faculdades;
create policy republica_faculdades_leitura on republica_faculdades
    for select using (republica_visivel(republica_id));

drop policy if exists republica_faculdades_escrita on republica_faculdades;
create policy republica_faculdades_escrita on republica_faculdades
    for all using (e_dono_da_republica(republica_id))
    with check (e_dono_da_republica(republica_id));


-- ---------------------------------------------------------------------
-- Confira antes de fechar a aba:
--
--   select r.nome, f.sigla, rf.minutos
--     from republica_faculdades rf
--     join republicas  r on r.id = rf.republica_id
--     join faculdades  f on f.id = rf.faculdade_id
--    order by r.nome, f.sigla;
--
-- Deve aparecer uma linha para cada vaga que já tinha faculdade
-- escolhida, com o mesmo tempo que estava em republicas.minutos.
--
-- ---------------------------------------------------------------------
-- O PASSO 3, PARA DEPOIS
--
-- Só quando o site no ar já estiver lendo desta tabela -- confira com
--   curl -s https://acheirepublica.com.br/js/vitrine.js | grep republica_faculdades
-- e só então, num arquivo novo:
--
--   alter table republicas drop column faculdade_id;
--   alter table republicas drop column minutos;
--
-- Antes disso, não. Coluna apagada que o código ainda pede não devolve
-- erro naquele campo: derruba a consulta inteira, e a vitrine fica
-- vazia sem dizer por quê.
-- ---------------------------------------------------------------------
