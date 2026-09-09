-- =====================================================================
-- Achei República — a UNIFAL são dois campi, e ficam a 4,4 km um do outro
--
-- Rode DEPOIS do 24-coordenadas-das-faculdades.sql.
--
-- ---------------------------------------------------------------------
-- O QUE ESTAVA ERRADO
--
-- Alfenas tinha duas linhas: UNIFAL e UNIFENAS. Mas a UNIFAL tem DUAS
-- unidades na cidade, e a diferença entre elas muda onde vale a pena
-- morar:
--
--   Campus Sede ........... Rua Gabriel Monteiro da Silva, 700 · Centro
--   Unidade Santa Clara ... Av. Jovino Fernandes Sales, 2600 · Santa Clara
--
-- É a mesma coisa que o 17-belo-horizonte.sql resolveu para a PUC:
-- "faculdade" e "lugar" deixaram de ser a mesma coisa. Em Alfenas isso
-- passou batido porque a cidade é pequena — e não é.
--
-- Quem estuda Fisioterapia, Geografia, Ciência da Computação ou Física
-- estuda em Santa Clara. Com uma linha só, essa pessoa recebia como
-- "perto" uma casa ao lado do Centro e descobria o engano no dia da
-- visita.
--
-- ---------------------------------------------------------------------
-- MEDIDO, E NÃO ESTIMADO
--
-- 3,68 km em linha reta. A pé, o Google responde 4,4 km e 1 hora e 1
-- minuto; de carro, 11 minutos. Nenhuma leitura da regra do 17 põe isso
-- na mesma linha.
--
-- Uma armadilha que quase entrou aqui: o CEP da unidade (37133-840)
-- devolve uma coordenada 1 km do Centro, três quilômetros fora do
-- lugar. CEP de bairro grande cai no meio da faixa, não na porta. As
-- coordenadas abaixo vieram do Google, que resolveu as duas unidades
-- pelo nome e traçou a rota entre elas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. "UNIFAL" sozinho vira "UNIFAL Sede"
--
-- Com duas unidades, a sigla precisa dizer qual — é o que o estudante
-- lê na ficha "Perto da faculdade". O id não muda, então a vaga que já
-- aponta para esta linha continua apontando.
--
-- A coordenada também é acertada: a que estava vinha do OpenStreetMap
-- e caía 110 metros ao lado. Pouco, mas de graça.
-- ---------------------------------------------------------------------
update faculdades f
   set sigla = 'UNIFAL Sede',
       nome  = 'Universidade Federal de Alfenas — campus Sede',
       lat   = -21.420964,
       lng   = -45.948619
  from cidades c
 where c.id = f.cidade_id
   and c.slug = 'alfenas'
   and f.sigla = 'UNIFAL';


-- ---------------------------------------------------------------------
-- 2. Santa Clara entra
-- ---------------------------------------------------------------------
insert into faculdades (cidade_id, nome, sigla, lat, lng)
select c.id,
       'Universidade Federal de Alfenas — Unidade Santa Clara',
       'UNIFAL Santa Clara',
       -21.418638, -45.984054
  from cidades c
 where c.slug = 'alfenas'
   and not exists (
       select 1 from faculdades x
        where x.cidade_id = c.id and x.sigla = 'UNIFAL Santa Clara'
   );


-- =====================================================================
-- CONFERIR
--
--   select f.sigla, f.nome, f.lat, f.lng
--     from faculdades f join cidades c on c.id = f.cidade_id
--    where c.slug = 'alfenas'
--    order by f.sigla;
--
-- Esperado: três linhas — UNIFAL Santa Clara, UNIFAL Sede e UNIFENAS —
-- e nenhuma com lat nulo.
--
-- E que ninguém tenha ficado órfão da renomeação:
--
--   select count(*) from republica_faculdades rf
--     join faculdades f on f.id = rf.faculdade_id
--    where f.sigla = 'UNIFAL Sede';
--
-- ---------------------------------------------------------------------
-- O QUE AINDA FALTA EM ALFENAS — decisão do Igor, que mora lá
--
-- A UNIFENAS também publica mais de um endereço na cidade, e eu não sei
-- o peso de cada um. Não entram por chute:
--
--   1. Campus Universitário, Rodovia MG-179, Km 0 — é o que já está
--      cadastrado como "UNIFENAS".
--
--   2. Rua Geraldo Freitas da Costa, 120 · Cruz Preta — aparece nos
--      contatos da universidade. É prédio de aula ou é administrativo?
--      Se tem turma, vira linha.
--
--   3. Hospital Universitário Alzira Velano — a própria UNIFENAS diz
--      que a Medicina tem aula lá. Estudante de Medicina passa mais
--      tempo no hospital que no campus, e o hospital não fica ao lado
--      do campus. Se for assim, é a linha que mais muda a decisão de
--      morar em Alfenas, e é a que está faltando.
--
-- Modelo para acrescentar, com a coordenada conferida antes:
--
--   insert into faculdades (cidade_id, nome, sigla, lat, lng)
--   select id, 'Nome por extenso', 'SIGLA CURTA', -21.000000, -45.000000
--     from cidades where slug = 'alfenas';
--
-- Busque a coordenada pelo NOME do prédio, e não pelo CEP. Foi o CEP
-- que quase pôs a Santa Clara três quilômetros fora do lugar.
-- =====================================================================
