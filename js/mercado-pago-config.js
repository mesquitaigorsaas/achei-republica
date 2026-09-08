/* =====================================================================
   Mercado Pago — a chave PÚBLICA, e só ela.

   Esta chave é para ficar no navegador. É com ela que o formulário de
   pagamento troca o número do cartão por um token, na máquina de quem
   está comprando, antes de qualquer coisa sair de lá. Ela não cobra
   ninguém: serve para criar token e nada mais.

   ---------------------------------------------------------------------
   O QUE NÃO PODE ENTRAR NESTE ARQUIVO

   O access token (o que começa com APP_USR- e tem o poder de cobrar).
   Ele mora nos segredos do Supabase e só é lido dentro da função de
   borda:

       supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...

   Colar o access token aqui publicaria, no código-fonte do site, a
   permissão de criar cobranças em nome da conta. Qualquer visitante lê
   o código-fonte.

   ---------------------------------------------------------------------
   ONDE ACHAR A CHAVE PÚBLICA

   Painel do Mercado Pago → Seus negócios → Configurações → Gerenciar
   credenciais. Há duas, e as duas funcionam aqui:

   - Credenciais de TESTE: começa com TEST-. Nenhum dinheiro se move, e
     é com ela que se testa o formulário inteiro.
   - Credenciais de PRODUÇÃO: começa com APP_USR-. Cobra de verdade.

   As duas precisam combinar com o access token do outro lado: chave
   pública de teste com access token de teste, produção com produção.
   Misturadas, o Mercado Pago recusa o token do cartão sem explicar por
   quê.

   Enquanto estiver escrito COLE_AQUI, o site não oferece pagamento:
   diz que o destaque ainda não está disponível, em vez de abrir um
   formulário que não vai completar.
   ===================================================================== */
window.CONFIG_MERCADO_PAGO = {
    chavePublica: 'COLE_AQUI_A_CHAVE_PUBLICA_DO_MERCADO_PAGO'
};
