-- =====================================================================
-- Achei República — fechando a porta que o 12 deixou encostada
--
-- Rode DEPOIS do 13-metricas-da-vaga.sql. É curto, é urgente, e a razão
-- de existir vale ser lida inteira porque é uma armadilha que vai
-- reaparecer em toda função nova deste projeto.
--
-- ---------------------------------------------------------------------
-- O QUE ESTAVA ERRADO
-- ---------------------------------------------------------------------
--
-- O 12-destaque-da-vaga.sql termina cada função sensível com:
--
--     revoke all on function ativar_promocao(...) from public;
--
-- E isso NÃO BASTA no Supabase.
--
-- No Postgres, toda função nasce com EXECUTE liberado para o papel
-- PUBLIC. Revogar de PUBLIC tira essa herança — e num Postgres comum
-- seria o fim da história.
--
-- Só que o Supabase acrescenta uma segunda camada: ele mantém
-- privilégios padrão no schema public concedendo EXECUTE a "anon" e
-- "authenticated" em toda função criada ali. São concessões DIRETAS a
-- esses dois papéis, e não a herança do PUBLIC. Revogar de PUBLIC não
-- encosta nelas.
--
-- Resultado, conferido no navegador contra o banco de verdade: um
-- visitante SEM CONTA chamou ativar_promocao() e recebeu de volta
-- "PROMOCAO_INEXISTENTE" — a mensagem da própria função, provando que
-- ela executou. A resposta certa seria "permission denied".
--
-- Com um id de promoção real na mão — e o dono de uma vaga enxerga os
-- ids das promoções dele, por RLS — bastava uma linha no console para
-- acender 30 dias de Pro sem pagar. Todo o cuidado do webhook (conferir
-- assinatura, perguntar de volta ao Mercado Pago, comparar o valor)
-- seria contornado por uma porta lateral.
--
-- Nada foi explorado: quando isto foi encontrado ainda não existia
-- nenhuma promoção no banco, e portanto nenhum id para usar.
--
-- ---------------------------------------------------------------------
-- A REGRA, DAQUI EM DIANTE
-- ---------------------------------------------------------------------
--
-- Neste projeto, revogar de "public" nunca é suficiente. Toda função
-- que não deve ser chamada pelo navegador precisa, explicitamente:
--
--     revoke all on function nome(args) from public, anon, authenticated;
--
-- E vale a inversão de leitura: se uma função é SECURITY DEFINER, ela
-- roda com poder de dono e ignora RLS. A pergunta não é "quem eu quero
-- que chame?", é "o que acontece se o pior visitante da internet
-- chamar isto com os argumentos mais convenientes para ele?".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. As duas que mexem em pagamento
--
-- Só a service_role executa — e a service_role só existe dentro das
-- funções de borda, nunca no navegador.
-- ---------------------------------------------------------------------
revoke all on function ativar_promocao(uuid, text, text, jsonb)
    from public, anon, authenticated;

revoke all on function recusar_promocao(uuid, text, text, jsonb)
    from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. As de apoio
--
-- destaque_vigente() devolve só o plano e a data de uma vaga — coisa
-- que o site mostra na tela de qualquer jeito. Não havia vazamento
-- aqui. Fecha junto porque superfície que não serve para nada não
-- precisa ficar aberta.
--
-- As duas de gatilho o Postgres já recusa fora de um trigger, mas o
-- mesmo argumento vale.
-- ---------------------------------------------------------------------
revoke all on function destaque_vigente(uuid)         from public, anon, authenticated;
revoke all on function sincronizar_destaque()         from public, anon, authenticated;
revoke all on function refletir_promocao_na_vaga()    from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. expirar_promocoes(): continua aberta, mas passa a conferir
--
-- Ela é chamada pelo botão "Arrumar os vencidos" do painel, então
-- precisa ser executável por conta logada. O que ela NÃO precisava era
-- rodar para qualquer conta logada.
--
-- O risco era pequeno de propósito — a função só troca o rótulo de
-- promoções que já venceram, e não desliga nada — mas "pequeno" não é
-- motivo para deixar assim quando a correção é uma linha.
--
-- Devolve 0 para quem não é administrador, em vez de erro: o botão não
-- existe fora do painel, e quem chegar aqui por outro caminho não
-- precisa saber que a função existe.
-- ---------------------------------------------------------------------
create or replace function expirar_promocoes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    quantas integer;
begin
    if not sou_admin() then
        return 0;
    end if;

    with vencidas as (
        update promocoes
           set status = 'expirada'
         where status = 'ativa'
           and termina_em <= now()
        returning id
    )
    select count(*) into quantas from vencidas;

    return quantas;
end $$;

revoke all on function expirar_promocoes() from public, anon, authenticated;
grant execute on function expirar_promocoes() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Conferindo o resto da casa
--
-- Estas continuam abertas, e cada uma por um motivo:
--
--   registrar_metricas()  — anon, de propósito. A maior parte das
--     visitas vem de quem nunca vai criar conta. Ela só soma contador,
--     valida os tipos e não devolve nada.
--
--   registrar_busca()     — anon, de propósito. Mesmo caso.
--
--   telefone_ja_cadastrado() — anon, do 04. Responde só sim ou não.
--
--   resumo_da_vaga()      — authenticated, e a primeira coisa que ela
--     faz é conferir se quem pergunta é o dono da vaga ou admin.
--
--   admin_*()             — authenticated, e todas começam com
--     sou_admin() no WHERE. Para quem não é, voltam vazias.
--
--   sou_admin()           — authenticated. Responde sobre quem está
--     perguntando, e não serve para descobrir nada sobre ninguém.
-- ---------------------------------------------------------------------


-- =====================================================================
-- PARA CONFERIR DEPOIS DE RODAR
--
-- 1. A prova direta. Abra o site SEM ESTAR LOGADO, tecle F12, vá em
--    Console e cole:
--
--      await banco.rpc('ativar_promocao',
--            { p_promocao: '00000000-0000-0000-0000-000000000000',
--              p_referencia: 'x' });
--
--    ANTES deste arquivo, respondia:
--        PROMOCAO_INEXISTENTE: 00000000-...   (a função rodou!)
--
--    DEPOIS, tem que responder:
--        permission denied for function ativar_promocao
--
--    Se ainda disser PROMOCAO_INEXISTENTE, este arquivo não rodou.
--
-- 2. Quem ainda pode executar o quê (deve listar anon/authenticated
--    apenas nas funções da lista do item 4):
--
--      select p.proname,
--             coalesce(array_to_string(p.proacl, ' | '), 'sem ACL: so o dono')
--        from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('ativar_promocao','recusar_promocao',
--                           'destaque_vigente','expirar_promocoes',
--                           'registrar_metricas','resumo_da_vaga')
--       order by p.proname;
--
--    Em ativar_promocao e recusar_promocao NÃO pode aparecer "anon="
--    nem "authenticated=".
-- =====================================================================
