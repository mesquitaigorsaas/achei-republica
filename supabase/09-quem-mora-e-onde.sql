-- =====================================================================
-- Achei República — quem mora na casa, e onde a casa fica
--
-- Rode DEPOIS do 08-fotos-das-republicas.sql.
--
-- Duas perguntas que o estudante faz na primeira mensagem e que o
-- anúncio não respondia:
--
--   "quantas pessoas moram aí?"   e   "onde exatamente fica?"
--
-- Não responder custa caro dos dois lados: são as duas mensagens que o
-- anunciante repete quinze vezes por semana, e são o motivo de metade
-- das visitas que terminam na porta.
-- =====================================================================


-- ---------------------------------------------------------------------
-- QUEM MORA
--
-- "Quero um quarto, mas não numa casa cheia de estudante" é um pedido
-- real e hoje impossível de fazer no site. Tem quem procure justamente
-- o contrário: casa só de estudante, porque quer companhia de quem
-- está na mesma rotina de prova.
--
-- São duas informações diferentes e as duas importam:
--   composicao — QUEM mora (só os donos, só estudantes, os dois)
--   moradores  — QUANTOS moram hoje, sem contar a vaga anunciada
--
-- Uma sem a outra não resolve: "só estudantes" pode ser dois ou nove, e
-- a diferença entre dois e nove é a fila do banheiro de manhã.
-- ---------------------------------------------------------------------
alter table republicas add column if not exists composicao text;

alter table republicas drop constraint if exists republicas_composicao_conhecida;
alter table republicas add constraint republicas_composicao_conhecida
    check (composicao is null or composicao in ('donos', 'estudantes', 'donos_e_estudantes'));

-- Quantos moram HOJE. Zero é resposta legítima: casa vazia inteira para
-- alugar, ou kitnet. O teto de 30 não é regra de negócio, é peneira de
-- dedo escorregado — ninguém aluga quarto em casa de 300 moradores.
alter table republicas add column if not exists moradores integer;

alter table republicas drop constraint if exists republicas_moradores_plausivel;
alter table republicas add constraint republicas_moradores_plausivel
    check (moradores is null or (moradores >= 0 and moradores <= 30));


-- ---------------------------------------------------------------------
-- ONDE A CASA FICA
--
-- Até aqui o anúncio tinha só o bairro. "Centro" numa cidade pequena é
-- meia cidade, e o estudante que está escolhendo entre três casas
-- precisa saber qual delas fica no caminho da faculdade.
--
-- ATENÇÃO, e a decisão é sua: isto fica PÚBLICO. Qualquer visitante,
-- sem conta, vê a rua e o número. É o contrário do que acontece nos
-- classificados, onde o endereço do anunciante mora em perfis e nunca
-- sai de lá. Se um dia isso incomodar, o caminho mais curto é parar de
-- mostrar o número na página da vaga e mandá-lo no WhatsApp — os dados
-- continuam aqui, só deixam de ser desenhados.
-- ---------------------------------------------------------------------
alter table republicas add column if not exists cep         text;
alter table republicas add column if not exists logradouro  text;
alter table republicas add column if not exists numero      text;
alter table republicas add column if not exists complemento text;

-- Coordenadas, para o dia em que o trajeto for calculado por mapa em
-- vez de informado pelo anunciante. Ficam nulas por enquanto: o mapa da
-- página da vaga é montado pelo endereço escrito, que não precisa
-- delas e não custa chave de API nenhuma.
alter table republicas add column if not exists lat numeric;
alter table republicas add column if not exists lng numeric;


-- ---------------------------------------------------------------------
-- Obrigatório de verdade
--
-- Exigir só no formulário é o mesmo que não exigir: a chave pública
-- está no código-fonte, e qualquer um insere pela linha de comando sem
-- passar pela página.
--
-- A amarra vale só para anúncio NO AR. Assim um rascunho ou um anúncio
-- tirado do ar para revisão não fica impossível de salvar por causa de
-- um campo em branco — o que travaria justamente a hora em que a
-- pessoa está consertando o anúncio.
--
-- NOT VALID, e é de propósito: os anúncios que já existiam nasceram sem
-- endereço, porque a coluna não existia. Sem o NOT VALID, esta linha
-- falha e o arquivo inteiro é desfeito — foi o que aconteceu na
-- primeira tentativa.
--
-- O que NOT VALID faz: a regra passa a valer para tudo que for gravado
-- ou EDITADO daqui em diante, e não olha para trás. Na prática o
-- anúncio antigo continua no ar, mas na primeira vez que for salvo terá
-- que ganhar endereço — que é exatamente o que se quer.
-- ---------------------------------------------------------------------
alter table republicas drop constraint if exists republicas_no_ar_tem_endereco;
alter table republicas add constraint republicas_no_ar_tem_endereco
    check (
        not (ativa and status = 'publicada')
        or (coalesce(logradouro, '') <> '' and coalesce(numero, '') <> '')
    ) not valid;

-- Quais anúncios estão no ar sem endereço. Depois de preencher todos,
-- dá para exigir a regra também do passado com:
--
--   alter table republicas validate constraint republicas_no_ar_tem_endereco;
--
-- Enquanto esta consulta devolver linha, aquele comando vai falhar.
--   select id, nome, bairro from republicas
--    where ativa and status = 'publicada'
--      and (coalesce(logradouro,'') = '' or coalesce(numero,'') = '');


-- ---------------------------------------------------------------------
-- Para conferir depois de rodar:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_name = 'republicas'
--      and column_name in ('composicao','moradores','cep','logradouro',
--                          'numero','complemento','lat','lng')
--    order by column_name;
--
-- Devem aparecer as oito.
--
-- E a amarra do endereço, que deve FALHAR:
--
--   insert into republicas (dono_id, cidade_id, nome, tipo, preco, bairro)
--   values (auth.uid(), (select id from cidades where slug='alfenas'),
--           'Teste sem endereco', 'quarto_individual', 500, 'Centro');
--
-- Deve dar "republicas_no_ar_tem_endereco". Repetir com logradouro e
-- numero preenchidos deve passar.
-- ---------------------------------------------------------------------
