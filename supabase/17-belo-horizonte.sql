-- =====================================================================
-- Achei República — Belo Horizonte entra
--
-- A primeira cidade fora do Sul de Minas, e a primeira capital. Ela
-- muda uma premissa que estava embutida no projeto sem ninguém ter
-- decidido: até aqui, "faculdade" e "lugar" eram a mesma coisa. Em
-- Alfenas, UNIFAL é UM endereço. Em BH, PUC Minas são quatro endereços
-- espalhados por quinze quilômetros.
--
-- ---------------------------------------------------------------------
-- POR QUE UMA LINHA POR CAMPUS
--
-- O trajeto até a faculdade é metade da nota de compatibilidade, e o
-- anunciante informa esse trajeto para UMA faculdade escolhida na
-- lista. Com uma linha só chamada "PUC Minas", quem estuda no Barreiro
-- receberia como perto uma casa vizinha ao Coração Eucarístico — e
-- descobriria o engano no dia da visita, que é o pior lugar possível
-- para descobrir.
--
-- A regra que separa: **campus vira linha própria quando a distância
-- entre eles muda a decisão de morar**. Por isso UFMG Pampulha e UFMG
-- Saúde são duas linhas (8 km), e a FUMEC é uma só — as unidades do
-- Cruzeiro e do Anchieta ficam a dez minutos a pé uma da outra, e
-- separá-las seria ruído fingindo de precisão.
--
-- ---------------------------------------------------------------------
-- O QUE A COLUNA "sigla" VIROU
--
-- Ela nasceu para guardar "UNIFAL". Aqui guarda "UFMG Pampulha". Não é
-- desvio: sigla é o que o ESTUDANTE LÊ na ficha "Perto da faculdade" da
-- home — o js/script.js monta aquele seletor com o valor desta coluna,
-- sem o nome por extenso. Um código como "PUC-CE" não diria nada a
-- ninguém. O nome por extenso continua em "nome", e é ele que aparece
-- para o anunciante, no formato "sigla — nome".
--
-- ---------------------------------------------------------------------
-- ENDEREÇOS CONFERIDOS NA FONTE, EM 08/09/2026
--
-- Cada campus abaixo foi conferido no site da própria instituição, e
-- não escrito de cabeça — errar campus aqui estraga o cálculo de
-- trajeto para todo mundo daquela faculdade. O bairro vai no comentário
-- de cada linha porque é o que permite conferir depois sem abrir o
-- navegador.
--
-- Contagem, Betim e Nova Lima NÃO entram aqui. São municípios
-- próprios, e pendurá-los em Belo Horizonte faria o filtro de cidade
-- mentir. Entram como cidade quando houver república lá.
-- =====================================================================

insert into cidades (nome, uf, slug, ativa) values
    ('Belo Horizonte', 'MG', 'belo-horizonte', false)
on conflict (slug) do nothing;


insert into faculdades (cidade_id, nome, sigla)
select c.id, f.nome, f.sigla
from cidades c
cross join (values
    -- Federais e estaduais
    ('Universidade Federal de Minas Gerais — campus Pampulha',      'UFMG Pampulha'),          -- Av. Antônio Carlos, 6627 · Pampulha
    ('Universidade Federal de Minas Gerais — campus Saúde',         'UFMG Saúde'),             -- Av. Alfredo Balena, 190 · Santa Efigênia
    ('CEFET-MG — campus I',                                         'CEFET Nova Suíça'),       -- Av. Amazonas, 5253 · Nova Suíça
    ('CEFET-MG — campus II',                                        'CEFET Gameleira'),        -- Av. Amazonas, 7675 · Nova Gameleira

    -- PUC Minas
    ('PUC Minas — Coração Eucarístico',                             'PUC Coração Eucarístico'),-- Av. Dom José Gaspar, 500
    ('PUC Minas — São Gabriel',                                     'PUC São Gabriel'),        -- Rua Walter Ianni, 255 · São Gabriel
    ('PUC Minas — Barreiro',                                        'PUC Barreiro'),           -- Av. Afonso Vaz de Melo, 1200 · Barreiro
    ('PUC Minas — Praça da Liberdade',                              'PUC Liberdade'),          -- Lourdes

    -- UniBH
    ('Centro Universitário de Belo Horizonte — Estoril',            'UniBH Estoril'),          -- Av. Prof. Mário Werneck, 1685 · Estoril
    ('Centro Universitário de Belo Horizonte — Cristiano Machado',  'UniBH Cristiano Machado'),
    ('Centro Universitário de Belo Horizonte — Lourdes',            'UniBH Lourdes'),

    -- Newton Paiva
    ('Centro Universitário Newton Paiva — Carlos Luz',              'Newton Carlos Luz'),      -- Av. Pres. Carlos Luz, 220 · Caiçaras
    ('Centro Universitário Newton Paiva — Silva Lobo',              'Newton Silva Lobo'),      -- Rua Silva Lobo, 1730 · Nova Granada

    -- Una
    ('Centro Universitário Una — Aimorés',                          'Una Aimorés'),            -- Rua dos Aimorés, 1451 · Lourdes
    ('Centro Universitário Una — Guajajaras',                       'Una Guajajaras'),         -- Rua dos Guajajaras, 175 · Centro
    ('Centro Universitário Una — Barreiro',                         'Una Barreiro'),           -- Rua Barão de Coromandel, 765 · Barreiro
    ('Centro Universitário Una — Linha Verde',                      'Una Linha Verde'),        -- vetor norte

    -- Uma unidade só, ou unidades vizinhas
    ('Universidade FUMEC',                                          'FUMEC'),                  -- Rua Cobre, 200 · Cruzeiro (e Anchieta, ao lado)
    ('Faculdade Ciências Médicas de Minas Gerais',                  'Ciências Médicas MG')     -- Alameda Ezequiel Dias, 275 · Centro
) as f(nome, sigla)
where c.slug = 'belo-horizonte'
  and not exists (
      select 1 from faculdades x
      where x.cidade_id = c.id and x.sigla = f.sigla
  );


-- ---------------------------------------------------------------------
-- Confira antes de fechar a aba:
--
--   select f.sigla, f.nome
--     from faculdades f join cidades c on c.id = f.cidade_id
--    where c.slug = 'belo-horizonte'
--    order by f.sigla;
--
-- Esperado: 19 linhas.
--
-- ---------------------------------------------------------------------
-- PARA ACRESCENTAR OUTRA DEPOIS
--
-- Ainda faltam instituições que o Igor conhece melhor que qualquer
-- busca: Izabela Hendrix, UEMG, IFMG campus BH, Estácio, Santa Casa,
-- Faculdade Arnaldo. Acrescentar é uma linha:
--
--   insert into faculdades (cidade_id, nome, sigla)
--   select id, 'Centro Universitário Metodista Izabela Hendrix', 'Izabela Hendrix'
--   from cidades where slug = 'belo-horizonte';
--
-- Não há unique constraint em (cidade_id, sigla): rodar duas vezes
-- duplica. O bloco acima se protege com o "not exists"; uma linha
-- solta como esta, não.
-- ---------------------------------------------------------------------
