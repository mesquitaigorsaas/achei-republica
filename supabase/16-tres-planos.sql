-- =====================================================================
-- Achei República — três planos, e os selos viram prata e ouro
--
-- POR QUE O PRO SAIU
--
-- Não foi preço: foi quantidade. Quatro planos são uma tabela; três são
-- uma frase. "Anunciar é grátis; se quiser mais visibilidade tem dois
-- degraus" se explica no balcão, sem papel na mão. Com quatro, a
-- república para de comparar e adia a decisão — e adiar é não comprar.
--
-- Ele também já vinha esvaziando. Cinco promessas caíram em duas levas:
-- área especial na página da cidade, faixa de entrada imediata e
-- relatório do período nunca existiram; atendimento prioritário e
-- divulgação nas redes eram possíveis, mas dependiam de alguém lembrar.
-- Sem elas, o Pro entregava sobre o Premium só o selo e a ordem, por
-- R$ 20 a mais. Não sustentava o próprio degrau.
--
-- O que era dele passa ao Premium: a prioridade máxima e o selo de cima.
--
--   Grátis     R$ 0        sempre
--   Destaque   R$ 19,90    selo prata,  peso 1
--   Premium    R$ 29,90    selo ouro,   peso 2   <- agora o topo
--   Pro        desligado
--
-- ---------------------------------------------------------------------
-- POR QUE **DESLIGAR** E NÃO APAGAR
--
-- `delete from planos where slug = 'pro'` seria o comando óbvio e o
-- errado. A tabela promocoes tem `plano text not null references
-- planos(slug)`: apagar a linha ou quebra a chave estrangeira, ou —
-- pior, se um dia alguém puser `on delete cascade` — leva junto o
-- histórico de quem pagou.
--
-- `ativo = false` já é entendido por todo o site: a home, a página de
-- planos e a função de cobrança buscam com `.eq('ativo', true)`, e a
-- cobrança recusa plano inativo antes de criar promoção. O plano some
-- de todas as telas e o passado continua de pé.
--
-- ---------------------------------------------------------------------
-- PRATA E OURO, E NÃO ESTRELA E FOGO
--
-- ⭐ e 🔥 eram duas coisas boas, e nada nelas dizia qual vinha primeiro.
-- Quem visse as duas na mesma lista não saberia que uma custou mais.
-- Dois metais dispensam legenda.
--
-- O emoji fica em DOIS lugares e os dois têm de concordar: a coluna
-- `selo` daqui, que a tela de planos lê, e o SELO_DO_PLANO do
-- js/planos.js, que desenha o selo em cima do anúncio. Mudou aqui,
-- muda lá.
-- =====================================================================

update planos set ativo = false where slug = 'pro';

update planos set selo = '🥈' where slug = 'destaque';
update planos set selo = '🥇' where slug = 'premium';

-- O Premium virou o topo da escada, e o degrau maior se sustenta: dobra
-- o Destaque, e a escada inteira se diz numa frase -- 19,90 ou 39,90.
update planos set preco_centavos = 3990 where slug = 'premium';

-- O Premium herda a chamada do Pro: ele é o topo agora.
update planos set chamada = 'Máxima exposição' where slug = 'premium';

-- Confira antes de fechar a aba:
--
--   select slug, nome, preco_centavos / 100.0 as reais, selo, peso, ativo
--     from planos order by ordem;
--
-- Esperado: gratuito 0 · destaque 19.90 🥈 · premium 29.90 🥇 · pro com
-- ativo = false.
--
-- O peso do Premium continua 2, e não vira 3. Peso não é posição no
-- catálogo: é a ordem entre anúncios: 2 já é o maior que existe agora,
-- e mexer nele mudaria a posição de quem comprou ontem sem motivo.
