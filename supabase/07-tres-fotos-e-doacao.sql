-- =====================================================================
-- Achei República — três fotos, e dizer se vende ou doa
--
-- Rode DEPOIS do 06-fotos-dos-itens.sql.
--
-- Duas correções de desenho, feitas antes de existir o primeiro
-- anúncio — que é a hora barata de corrigir.
--
-- 1. Uma foto não conta a história de um móvel. A escrivaninha de
--    frente parece inteira; a de lado mostra o tampo descascado. Quem
--    compra usado quer ver os dois, e quem vende honesto quer mostrar.
--
-- 2. "Preço zero" não é a mesma coisa que "estou doando". O primeiro é
--    um campo esquecido em branco; o segundo é uma decisão. Deixar o
--    site adivinhar pelo número faz anúncio sem preço virar doação sem
--    ninguém ter dito isso — e alguém aparecendo para buscar de graça
--    uma coisa que estava à venda.
-- =====================================================================

-- Um array e não três colunas: "foto2" e "foto3" vazias em quase todo
-- anúncio, e a pergunta "quantas fotos tem?" viraria três ifs. Com
-- array é length. O limite de três vive no check, num lugar só.
alter table itens add column if not exists fotos text[] not null default '{}';

alter table itens drop constraint if exists itens_ate_tres_fotos;
alter table itens add constraint itens_ate_tres_fotos
    check (array_length(fotos, 1) is null or array_length(fotos, 1) <= 3);

-- A coluna antiga vira a primeira do array, para nenhum anúncio já
-- existente perder a foto. Hoje a tabela está vazia e isto não faz
-- nada; existe para o arquivo poder ser rodado num banco que já tenha
-- anúncios, sem pensar duas vezes.
update itens
   set fotos = array[foto_url]
 where foto_url is not null
   and coalesce(array_length(fotos, 1), 0) = 0;

alter table itens drop column if exists foto_url;


-- Vender ou doar, dito com todas as letras. O padrão é venda: é o caso
-- comum, e errar para "venda" só faz alguém perguntar o preço —
-- enquanto errar para "doação" faz alguém atravessar a cidade achando
-- que vai levar de graça.
alter table itens add column if not exists modo text not null default 'venda';

alter table itens drop constraint if exists itens_modo_conhecido;
alter table itens add constraint itens_modo_conhecido
    check (modo in ('venda', 'doacao'));

-- Doação não tem preço. Sem esta amarra, dava para gravar "doação, R$
-- 80" e a vitrine teria que escolher em quem acreditar.
alter table itens drop constraint if exists itens_doacao_sem_preco;
alter table itens add constraint itens_doacao_sem_preco
    check (modo = 'venda' or preco = 0);


-- ---------------------------------------------------------------------
-- Para conferir depois de rodar:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_name = 'itens'
--    order by ordinal_position;
--
-- Deve aparecer "fotos" como ARRAY e "modo" como text, e NÃO deve
-- aparecer "foto_url".
--
-- E que as amarras estão de pé — as duas linhas abaixo devem FALHAR:
--
--   -- doação com preço:
--   insert into itens (dono_id, cidade, comodo, titulo, whatsapp, modo, preco)
--   values (auth.uid(), 'alfenas', 'cozinha', 'Teste', '35999999999', 'doacao', 80);
--
--   -- quatro fotos:
--   insert into itens (dono_id, cidade, comodo, titulo, whatsapp, fotos)
--   values (auth.uid(), 'alfenas', 'cozinha', 'Teste', '35999999999',
--           array['a','b','c','d']);
-- ---------------------------------------------------------------------
