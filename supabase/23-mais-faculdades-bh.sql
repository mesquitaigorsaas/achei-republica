-- =====================================================================
-- Achei República — as faculdades de BH que faltavam
--
-- Rode DEPOIS do 22-endereco-no-painel.sql.
--
-- O 17-belo-horizonte.sql deixou seis instituições em aberto, anotadas
-- como "só o Igor decide": Izabela Hendrix, UEMG, IFMG campus BH,
-- Estácio, Santa Casa e Faculdade Arnaldo. Endereços conferidos na
-- fonte em 09/09/2026, como manda a casa desde o 17.
--
-- Duas das seis NÃO entram, e o motivo é de fato, não de gosto:
--
--   IZABELA HENDRIX — não existe mais em BH. A PUC Minas arrematou o
--   prédio da Praça da Liberdade em dezembro de 2023, e ele virou o
--   campus Lourdes (Rua da Bahia, 2020). Cadastrar seria mandar o
--   estudante para uma faculdade que fechou. O que este arquivo faz é
--   o contrário: acerta o nome da linha que você já tem.
--
--   IFMG — não tem campus em Belo Horizonte. Tem a Reitoria, que é
--   administrativa e não tem aluno. Os campi mais perto são Betim,
--   Ibirité, Ribeirão das Neves, Sabará e Santa Luzia, todos
--   municípios próprios — e o 17 já decidiu que município próprio não
--   se pendura em BH.
--
-- ---------------------------------------------------------------------
-- DUAS DECISÕES QUE SÃO SUAS, IGOR
--
-- A regra do 17 é: campus vira linha própria quando a distância entre
-- eles muda a decisão de morar. Ela é clara nos extremos e discutível
-- no meio. Os dois casos do meio aqui:
--
--   1. UEMG — a Faculdade de Educação e a Faculdade de Políticas
--      Públicas dividem o MESMO endereço (Prudente de Morais, 444).
--      Viraram uma linha só, "UEMG Cidade Jardim". Duas linhas no
--      mesmo portão seriam duas escolhas para o mesmo trajeto.
--
--   2. ARNALDO — Funcionários e Anchieta ficam a uns três quilômetros
--      um do outro. Separei, mas sem convicção: é perto demais para
--      mudar de bairro e longe demais para ir a pé. Se você achar que
--      é ruído, apague a linha do Anchieta antes de rodar.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. O nome que ficou velho
--
-- A unidade da PUC na Praça da Liberdade passou a se chamar Campus
-- Lourdes. É o mesmo lugar e a mesma linha: só o rótulo muda.
--
-- A sigla é o que o estudante LÊ na ficha "Perto da faculdade", então
-- ela precisa dizer o nome de hoje. O id não muda, e por isso nenhuma
-- vaga já cadastrada perde o vínculo.
-- ---------------------------------------------------------------------
update faculdades f
   set nome  = 'PUC Minas — Lourdes',
       sigla = 'PUC Lourdes'
  from cidades c
 where c.id = f.cidade_id
   and c.slug = 'belo-horizonte'
   and f.sigla = 'PUC Liberdade';


-- ---------------------------------------------------------------------
-- 2. As que entram
--
-- Mesmo "not exists" do 17: rodar duas vezes não duplica, porque não
-- há unique constraint em (cidade_id, sigla).
-- ---------------------------------------------------------------------
insert into faculdades (cidade_id, nome, sigla)
select c.id, f.nome, f.sigla
from cidades c
cross join (values
    -- UEMG. Quatro endereços, três bairros distantes entre si.
    ('Universidade do Estado de Minas Gerais — Escola de Design',   'UEMG Design'),        -- Rua Gonçalves Dias, 1434 · Lourdes
    ('Universidade do Estado de Minas Gerais — Escola Guignard',    'UEMG Guignard'),      -- Rua Ascânio Burlamarque, 540 · Mangabeiras
    ('Universidade do Estado de Minas Gerais — Escola de Música',   'UEMG Música'),        -- Rua Riachuelo, 1351 · Padre Eustáquio
    ('Universidade do Estado de Minas Gerais — Cidade Jardim',      'UEMG Cidade Jardim'), -- Av. Prudente de Morais, 444 · Cidade Jardim (Educação e Políticas Públicas)

    -- Estácio. Venda Nova fica no vetor norte, longe das outras duas.
    ('Centro Universitário Estácio de Belo Horizonte — Floresta',   'Estácio Floresta'),   -- Av. Francisco Sales, 23 · Floresta
    ('Centro Universitário Estácio de Belo Horizonte — Prado',      'Estácio Prado'),      -- Rua Erê, 207 · Prado
    ('Centro Universitário Estácio de Belo Horizonte — Venda Nova', 'Estácio Venda Nova'), -- Rua Padre Pedro Pinto, 628 · Venda Nova

    -- Arnaldo. Ver a decisão 2 no cabeçalho antes de rodar.
    ('Arnaldo Centro Universitário — Funcionários',                 'Arnaldo Funcionários'), -- Praça Arnaldo Janssen, 200 · Funcionários
    ('Arnaldo Centro Universitário — Anchieta',                     'Arnaldo Anchieta'),     -- Rua Vitório Marçola, 360 · Anchieta
    ('Arnaldo Centro Universitário — Pilar',                        'Arnaldo Pilar'),        -- Rua Prof. Otílio Macedo, 12 · Pilar Olhos d'Água

    -- Santa Casa. Os dois endereços que ela publica ficam no mesmo
    -- quarteirão de Santa Efigênia: uma linha só.
    ('Faculdade de Saúde Santa Casa BH',                            'Santa Casa BH')       -- Av. Francisco Sales, 1111 · Santa Efigênia
) as f(nome, sigla)
where c.slug = 'belo-horizonte'
  and not exists (
      select 1 from faculdades x
      where x.cidade_id = c.id and x.sigla = f.sigla
  );


-- =====================================================================
-- CONFERIR
--
--   select f.sigla, f.nome
--     from faculdades f join cidades c on c.id = f.cidade_id
--    where c.slug = 'belo-horizonte'
--    order by f.sigla;
--
-- Esperado: 30 linhas. Eram 19 no 17, mais 11 aqui.
--
-- E confira que a PUC trocou de nome, sem virar duas:
--
--   select sigla, nome from faculdades f
--     join cidades c on c.id = f.cidade_id
--    where c.slug = 'belo-horizonte' and f.sigla like 'PUC%';
--
-- Esperado: quatro linhas, e nenhuma delas escrita "PUC Liberdade".
-- =====================================================================
