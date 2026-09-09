-- =====================================================================
-- Achei República — telefone é dígito, não é texto bonito
--
-- Rode DEPOIS do 18-varias-faculdades.sql.
--
-- ---------------------------------------------------------------------
-- O QUE APARECEU NO PAINEL
--
-- A lista de anunciantes mostrava "(55) 31983-0369". Não existe esse
-- telefone. O que existe é 31 98303-6983, digitado no cadastro com o
-- 55 do Brasil na frente, como quem copia de dentro do WhatsApp.
--
-- Dois defeitos somados, os dois já corrigidos no site:
--
--   1. A máscara de js/conta.js cortava em 11 dígitos e calava. Ela leu
--      o 55 como DDD e jogou fora os dois últimos dígitos.
--   2. auth/cadastro.html gravava o texto formatado, com parênteses e
--      traço, ao contrário do resto do site, que sempre salva só
--      dígitos. Um telefone assim não vira link de wa.me.
--
-- ---------------------------------------------------------------------
-- O QUE ESTE ARQUIVO FAZ, E O QUE ELE NÃO FAZ
--
-- FAZ: limpa o que está gravado e impede que texto formatado volte.
--
-- NÃO FAZ: não tira o 55 de ninguém. Aqui o banco não tem como saber a
-- diferença entre um número de Santa Maria, no Rio Grande do Sul, cujo
-- DDD é 55 de verdade, e um número de Belo Horizonte digitado com o
-- código do país. Os dois têm 11 dígitos e começam com 55. Adivinhar
-- estragaria os telefones legítimos do RS, que são mais numerosos que
-- os errados. A limpeza dos truncados é à mão, e está no fim.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Limpar o que está gravado
--
-- so_digitos() é do 04-anunciante.sql. Note que o índice único de
-- telefone já compara por so_digitos(), então esta limpeza não cria
-- nem desfaz duplicata nenhuma: o valor comparado é exatamente o
-- mesmo antes e depois.
-- ---------------------------------------------------------------------
update perfis
   set telefone = so_digitos(telefone)
 where telefone is not null
   and telefone <> so_digitos(telefone);


-- ---------------------------------------------------------------------
-- 2. Impedir que volte
--
-- Mesma regra que republicas.whatsapp já tinha desde o 08: dígitos,
-- com DDD, sem o zero na frente. Dez ou onze — fixo antigo e celular.
--
-- Se este comando falhar, é porque existe linha fora do formato. O
-- select do passo 3 mostra quais são; conserte e rode de novo.
-- ---------------------------------------------------------------------
alter table perfis drop constraint if exists perfis_telefone_digitos;
alter table perfis add constraint perfis_telefone_digitos
    check (telefone is null or telefone = ''
           or telefone ~ '^[1-9][0-9]{9,10}$');

comment on column perfis.telefone is
    'So digitos, com DDD, sem o 55 do pais. A mascara embeleza na tela.';


-- =====================================================================
-- 3. A PARTE À MÃO — os que já entraram truncados
--
-- Procure quem começa com 55 e pode ser vítima do corte antigo:
--
--   select u.email, p.nome, p.telefone
--     from perfis p join auth.users u on u.id = p.id
--    where p.telefone like '55%';
--
-- Para cada um, olhe e decida. É de Santa Maria (RS)? Então está certo,
-- deixe. É de outra cidade? Então o 55 é código de país, os dois
-- últimos dígitos se perderam no corte e NÃO dá para recuperá-los daqui
-- — o número verdadeiro nunca chegou ao banco. Escreva o certo:
--
--   update perfis set telefone = '31999999999'
--    where id = (select id from auth.users where email = 'a@conta.com')
--   returning telefone;
--
-- O returning é para não repetir a confusão de 09/09/2026: um update
-- que não acha nada responde "Success. No rows returned", igualzinho a
-- um que funcionou.
--
-- Confira o mesmo em republicas.whatsapp, que passou pela mesma
-- máscara e tem o mesmo problema:
--
--   select r.nome, r.whatsapp from republicas r where r.whatsapp like '55%';
-- =====================================================================
