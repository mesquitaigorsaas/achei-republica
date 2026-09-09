-- =====================================================================
-- Achei República — a coordenada de cada faculdade
--
-- Rode DEPOIS do 23-mais-faculdades-bh.sql.
--
-- ATENÇÃO: ESTE ARQUIVO AINDA NÃO ESTÁ PRONTO PARA RODAR.
-- Faltam três faculdades (a lista está no fim) e uma precisa de
-- conferência. Rodar assim não estraga nada — as três ficam com lat e
-- lng nulos, exatamente como estão hoje —, mas a conta de distância vai
-- ignorá-las até alguém completar.
--
-- ---------------------------------------------------------------------
-- POR QUE ISTO EXISTE
--
-- Hoje o tempo até a faculdade é DECLARADO pelo anunciante e ninguém
-- confere. Quem tem pressa de alugar escreve 10 onde são 20, e isso
-- sobe a casa na busca — o trajeto vale 20 dos 100 pontos da nota.
--
-- Testado em 09/09/2026 no único anúncio real do site: ele declara 10
-- minutos até a UNIFENAS, e o Google responde 22 minutos a pé, 1,5 km.
-- Não é hipótese.
--
-- Este é o passo 1 de quatro:
--
--   1. coordenada da faculdade      <- este arquivo
--   2. coordenada da casa, no cadastro, a partir do CEP
--   3. o site calcula a distância e passa a ordenar, filtrar e pontuar
--      por ela
--   4. o campo de minutos sai do cadastro, porque ninguém mais precisa
--
-- As colunas lat e lng existem desde o 01-esquema.sql, vazias, com o
-- comentário "para calcular trajeto de verdade mais para a frente".
-- Chegou a frente.
--
-- ---------------------------------------------------------------------
-- DE ONDE VIERAM OS NÚMEROS
--
-- Geocodificados em 09/09/2026 no Nominatim (OpenStreetMap), a partir
-- dos endereços que já estavam nos comentários do 17 e do 23. Serviço
-- gratuito, sem chave.
--
-- Cada linha abaixo diz o que o serviço encontrou:
--
--   EXATO ..... casou o número da porta, ou o próprio prédio da
--               instituição pelo nome.
--   NA RUA .... casou a rua e o bairro, sem o número. O erro é de um
--               quarteirão, e para ordenar casa por distância isso não
--               muda nada.
--
-- Coordenada não é endereço: para o link de trajeto no Maps o site
-- continua usando o nome da faculdade, que o Google resolve melhor.
-- =====================================================================

update faculdades f set lat = v.lat, lng = v.lng
  from (values
    -- EXATO
    ('UFMG Pampulha',            -19.863092, -43.959800),
    ('UFMG Saúde',               -19.924195, -43.929410),
    ('CEFET Nova Suíça',         -19.930082, -43.976228),
    ('CEFET Gameleira',          -19.939187, -43.999259),
    ('PUC Coração Eucarístico',  -19.922109, -43.991725),
    ('PUC São Gabriel',          -19.858268, -43.918388),
    ('PUC Lourdes',              -19.932402, -43.939586),
    ('Newton Carlos Luz',        -19.905912, -43.963591),
    ('FUMEC',                    -19.943563, -43.925382),
    ('Ciências Médicas MG',      -19.924082, -43.931111),
    ('UEMG Design',              -19.930727, -43.938236),
    ('UEMG Cidade Jardim',       -19.939656, -43.948122),
    ('Estácio Floresta',         -19.915391, -43.931884),
    ('Estácio Prado',            -19.922721, -43.960078),
    ('Arnaldo Anchieta',         -19.946237, -43.927422),
    ('Santa Casa BH',            -19.924736, -43.925600),
    ('UNIFAL',                   -21.420087, -45.949059),
    ('UNIFENAS',                 -21.446213, -45.947953),

    -- NA RUA
    ('PUC Barreiro',             -19.982534, -44.031356),
    ('UniBH Estoril',            -19.968850, -43.955957),
    ('Una Aimorés',              -19.926904, -43.944168),
    ('Una Guajajaras',           -19.924629, -43.942790),
    ('Una Barreiro',             -19.975542, -44.018999),
    ('UEMG Música',              -19.916093, -43.973519),
    ('Estácio Venda Nova',       -19.821125, -43.952860),
    ('Arnaldo Funcionários',     -19.928289, -43.927867),
    ('Arnaldo Pilar',            -20.000763, -43.972425),
    ('UniBH Cristiano Machado',  -19.866754, -43.927591)
  ) as v(sigla, lat, lng)
 where f.sigla = v.sigla;


-- =====================================================================
-- O QUE FALTA — não rode nada disto sem conferir
--
-- QUATRO PENDÊNCIAS, e nenhuma delas é chute que eu deva dar sozinho.
--
-- 1. Newton Silva Lobo (Rua Silva Lobo, 1730, Nova Granada)
--    O Nominatim não achou a rua com esse nome em Nova Granada.
--
-- 2. UEMG Guignard (Rua Ascânio Burlamarque, 540, Mangabeiras)
--    Endereço vem do site oficial da UEMG, mas o serviço não conhece
--    a rua.
--
-- 3. UniBH Lourdes
--    Nunca teve endereço escrito: entrou no 17 sem comentário.
--
-- 4. Una Linha Verde — CONFERIR ANTES DE USAR
--    A busca por "Avenida Cristiano Machado, 12001" devolveu a FAMINAS,
--    que é outra instituição. Ou o número está errado, ou as duas
--    dividem o endereço. Fica de fora até alguém olhar.
--
-- Como completar uma delas, depois de achar o endereço certo:
--
--   update faculdades set lat = -19.900000, lng = -43.900000
--    where sigla = 'UEMG Guignard'
--   returning sigla, lat, lng;
--
-- ---------------------------------------------------------------------
-- CONFERIR O QUE JÁ ENTROU
--
--   select f.sigla, f.lat, f.lng
--     from faculdades f join cidades c on c.id = f.cidade_id
--    where c.slug = 'belo-horizonte'
--    order by f.lat nulls first;
--
-- As sem coordenada aparecem primeiro. Devem ser exatamente quatro.
--
-- E um teste de sanidade: toda faculdade de BH tem que cair entre
-- -20,05 e -19,77 de latitude e entre -44,10 e -43,85 de longitude.
-- Qualquer uma fora disso foi geocodificada para a cidade errada.
--
--   select sigla, lat, lng from faculdades f
--     join cidades c on c.id = f.cidade_id
--    where c.slug = 'belo-horizonte'
--      and (lat not between -20.05 and -19.77
--       or  lng not between -44.10 and -43.85);
--
-- Esperado: nenhuma linha.
-- =====================================================================
