-- =====================================================================
-- Achei República — a coordenada de cada faculdade
--
-- Rode DEPOIS do 23-mais-faculdades-bh.sql.
--
-- ---------------------------------------------------------------------
-- POR QUE ISTO EXISTE
--
-- Hoje o tempo até a faculdade é DECLARADO pelo anunciante e ninguém
-- confere. Quem tem pressa de alugar escreve 10 onde são 20, e isso
-- sobe a casa na busca — o trajeto vale 20 dos 100 pontos da nota.
--
-- Medido em 09/09/2026 no único anúncio real do site: ele declara 10
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
-- Geocodificados em 09/09/2026 no Nominatim (OpenStreetMap), gratuito e
-- sem chave, a partir dos endereços que já estavam nos comentários do 17
-- e do 23. Os que faltavam foram conferidos no site de cada instituição
-- antes de virar coordenada.
--
-- Cada linha diz o que o serviço encontrou:
--
--   EXATO ..... casou o número da porta, ou o próprio prédio pelo nome.
--   NA RUA .... casou a rua e o bairro, sem o número. O erro é de um
--               quarteirão, e para ordenar casa por distância isso não
--               muda a ordem.
--
-- QUATRO ARMADILHAS que apareceram no caminho, todas resolvidas, e
-- escritas aqui porque quem for acrescentar a próxima vai tropeçar nas
-- mesmas:
--
--   Newton Silva Lobo — o comentário do 17 dizia "Rua Silva Lobo". É
--   AVENIDA Silva Lobo. Nenhuma busca achava.
--
--   UEMG Guignard — o mapa grafa a rua como "Ascanio Bulamarqui", e o
--   endereço oficial é "Ascânio Burlamarque". Buscar pelo nome do
--   prédio resolveu. Pelo CEP teria dado 3,8 km de erro: o CEP cai no
--   meio da faixa, não na porta.
--
--   Una Linha Verde — o número que eu tinha (12001) devolvia a FAMINAS,
--   outra instituição. O certo é 11157.
--
--   UniBH Lourdes — entrou no 17 sem endereço nenhum. É Rua Rio de
--   Janeiro, 1323.
--
-- Coordenada não é endereço: para o link de trajeto no Maps o site
-- continua usando o nome da faculdade, que o Google resolve melhor.
-- =====================================================================

update faculdades f set lat = v.lat, lng = v.lng
  from (values
    -- EXATO — casou a porta ou o prédio
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
    ('UEMG Guignard',            -19.955097, -43.920406),
    ('UEMG Cidade Jardim',       -19.939656, -43.948122),
    ('Estácio Floresta',         -19.915391, -43.931884),
    ('Estácio Prado',            -19.922721, -43.960078),
    ('Arnaldo Anchieta',         -19.946237, -43.927422),
    ('Santa Casa BH',            -19.924736, -43.925600),
    ('Una Linha Verde',          -19.826720, -43.944113),
    ('UniBH Cristiano Machado',  -19.874893, -43.925231),
    ('UNIFAL',                   -21.420087, -45.949059),
    ('UNIFENAS',                 -21.446213, -45.947953),

    -- NA RUA — rua e bairro certos, sem o número
    ('PUC Barreiro',             -19.982534, -44.031356),
    ('UniBH Estoril',            -19.968850, -43.955957),
    ('UniBH Lourdes',            -19.935646, -43.943226),
    ('Una Aimorés',              -19.926904, -43.944168),
    ('Una Guajajaras',           -19.924629, -43.942790),
    ('Una Barreiro',             -19.975542, -44.018999),
    ('UEMG Música',              -19.916093, -43.973519),
    ('Estácio Venda Nova',       -19.821125, -43.952860),
    ('Arnaldo Funcionários',     -19.928289, -43.927867),
    ('Arnaldo Pilar',            -20.000763, -43.972425),
    ('Newton Silva Lobo',        -19.940366, -43.967216)
  ) as v(sigla, lat, lng)
 where f.sigla = v.sigla;


-- =====================================================================
-- CONFERIR
--
-- 1. Ninguém pode ficar sem coordenada:
--
--      select sigla, lat, lng from faculdades where lat is null;
--
--    Esperado: nenhuma linha. São 32 faculdades e 32 pares aqui em cima.
--
-- 2. Toda faculdade de BH tem que cair dentro da cidade. Este é o teste
--    que pega geocodificação para o lugar errado, que é o erro caro:
--    coordenada torta não dá erro em lugar nenhum, só ordena a busca
--    errado para sempre.
--
--      select f.sigla, f.lat, f.lng
--        from faculdades f join cidades c on c.id = f.cidade_id
--       where c.slug = 'belo-horizonte'
--         and (f.lat not between -20.05 and -19.77
--          or  f.lng not between -44.10 and -43.85);
--
--    Esperado: nenhuma linha.
--
-- 3. E as de Alfenas, pela mesma razão:
--
--      select f.sigla, f.lat, f.lng
--        from faculdades f join cidades c on c.id = f.cidade_id
--       where c.slug = 'alfenas'
--         and (f.lat not between -21.50 and -21.38
--          or  f.lng not between -46.00 and -45.90);
--
--    Esperado: nenhuma linha.
--
-- ---------------------------------------------------------------------
-- PARA A PRÓXIMA FACULDADE QUE ENTRAR
--
-- Acrescente com coordenada desde o começo, senão ela nasce invisível
-- para a conta de distância:
--
--   update faculdades set lat = -19.900000, lng = -43.900000
--    where sigla = 'SIGLA NOVA'
--   returning sigla, lat, lng;
--
-- Para achar a coordenada sem sair do navegador, no console de qualquer
-- página do site:
--
--   fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1'
--       + '&countrycodes=br&q=' + encodeURIComponent('Nome da faculdade, Cidade, MG'))
--     .then(r => r.json()).then(j => console.log(j[0]));
--
-- Busque pelo NOME do prédio antes do endereço. Foi o que salvou a
-- Guignard, e é o que erra menos: rua tem grafia divergente, prédio não.
-- =====================================================================
