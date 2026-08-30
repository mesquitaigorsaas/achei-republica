-- =====================================================================
-- Achei República — dados iniciais
--
-- Rode DEPOIS do 01 e do 02.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cidades. Só Alfenas entra ativa: as outras aparecem como "em breve"
-- até receberem a primeira república cadastrada.
-- ---------------------------------------------------------------------
insert into cidades (nome, uf, slug, ativa) values
    ('Alfenas',                  'MG', 'alfenas',                  true),
    ('Varginha',                 'MG', 'varginha',                 false),
    ('Machado',                  'MG', 'machado',                  false),
    ('Campos Gerais',            'MG', 'campos-gerais',            false),
    ('Lavras',                   'MG', 'lavras',                   false),
    ('Itajubá',                  'MG', 'itajuba',                  false),
    ('Passos',                   'MG', 'passos',                   false),
    ('Pouso Alegre',             'MG', 'pouso-alegre',             false),
    ('Poços de Caldas',          'MG', 'pocos-de-caldas',          false),
    ('Três Corações',            'MG', 'tres-coracoes',            false),
    ('Santa Rita do Sapucaí',    'MG', 'santa-rita-do-sapucai',    false),
    ('São Sebastião do Paraíso', 'MG', 'sao-sebastiao-do-paraiso', false),
    ('Guaxupé',                  'MG', 'guaxupe',                  false),
    ('Muzambinho',               'MG', 'muzambinho',               false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Faculdades de Alfenas.
--
-- IGOR: cadastrei só as duas que tenho certeza de que ficam em Alfenas.
-- O resto quem sabe é você, que mora na região — e errar campus aqui
-- estraga o cálculo de trajeto, que é metade da nota de match.
--
-- Para acrescentar, copie o modelo comentado no fim deste arquivo.
-- As coordenadas podem ficar nulas por enquanto: só serão usadas quando
-- o trajeto passar a ser calculado por mapa em vez de informado pelo
-- anunciante.
-- ---------------------------------------------------------------------
insert into faculdades (cidade_id, nome, sigla)
select c.id, f.nome, f.sigla
from cidades c
cross join (values
    ('Universidade Federal de Alfenas',        'UNIFAL'),
    ('Universidade José do Rosário Vellano',   'UNIFENAS')
) as f(nome, sigla)
where c.slug = 'alfenas'
  and not exists (
      select 1 from faculdades x
      where x.cidade_id = c.id and x.sigla = f.sigla
  );

-- ---------------------------------------------------------------------
-- Modelo para acrescentar faculdade em qualquer cidade:
--
-- insert into faculdades (cidade_id, nome, sigla)
-- select id, 'Nome por extenso da instituição', 'SIGLA'
-- from cidades where slug = 'muzambinho';
-- ---------------------------------------------------------------------
