/* =====================================================================
   Achei República — criar a cobrança do destaque

   Roda no Supabase (Edge Function), e não no navegador. É a diferença
   entre um preço que o servidor decide e um preço que o cliente
   informa.

   O QUE ENTRA:  { republica_id, plano, metodo, dados }
                 e o token de quem está logado
   O QUE SAI:    { status, aprovado, pix_qr_base64, pix_copia_e_cola }

   Repare no que NÃO entra: o valor. O navegador manda o APELIDO do
   plano ('premium'), nunca o preço. Quem lê 3990 é esta função, na
   tabela planos. Se o preço viesse de fora, trocar 3990 por 1 no
   console compraria o Premium por um centavo — e a cobrança seria
   legítima do ponto de vista do Mercado Pago, porque foi a nossa
   própria função que pediu.

   ---------------------------------------------------------------------
   POR QUE COBRAMOS AQUI, EM VEZ DE MANDAR PARA O MERCADO PAGO

   A primeira versão criava uma "preferência" e jogava a pessoa no
   checkout deles. Funciona, e custa uma coisa cara: ela sai do site,
   encara uma tela pedindo login do Mercado Pago antes de qualquer
   campo, e boa parte desiste ali.

   Agora o formulário é do Mercado Pago mas mora na NOSSA página (o
   Payment Brick). O número do cartão nunca passa por aqui: o navegador
   o troca por um token direto com eles, usando a chave PÚBLICA. Esta
   função só vê esse token, que serve para uma cobrança e nada mais.

   O que chega em "dados" é o que o formulário deles preencheu. Dois
   campos que vêm de lá são IGNORADOS de propósito: o valor e a quem
   pertence a compra. Os dois são decididos aqui.

   O TOKEN DO MERCADO PAGO nunca aparece aqui em texto. Ele vive nos
   segredos do projeto:

       supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...

   ===================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/* De onde o site pode chamar. Lista fechada de propósito: com '*'
   qualquer página da internet poderia disparar cobranças em nome de
   quem estivesse logado aqui. */
const ORIGENS_PERMITIDAS = [
    'https://acheirepublica.com.br',
    'https://www.acheirepublica.com.br',
    'https://mesquitaigorsaas.github.io',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
];

function cabecalhos(origem: string | null) {
    const permitida = origem && ORIGENS_PERMITIDAS.includes(origem) ? origem : ORIGENS_PERMITIDAS[0];
    return {
        'Access-Control-Allow-Origin': permitida,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };
}

function responder(corpo: unknown, status: number, origem: string | null) {
    return new Response(JSON.stringify(corpo), { status, headers: cabecalhos(origem) });
}

Deno.serve(async (req) => {
    const origem = req.headers.get('origin');

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: cabecalhos(origem) });
    }

    if (req.method !== 'POST') {
        return responder({ erro: 'Método não permitido.' }, 405, origem);
    }

    const token = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!token) {
        /* Falha explícita e cedo. O desfecho ruim seria seguir adiante,
           criar a promoção e só descobrir na hora de cobrar — deixando
           uma promoção órfã "aguardando" para sempre. */
        console.error('MERCADO_PAGO_ACCESS_TOKEN não está configurado.');
        return responder({ erro: 'Pagamento indisponível no momento.' }, 500, origem);
    }

    /* -----------------------------------------------------------------
       Quem está pedindo

       Duas ligações com o banco, e a diferença entre elas é o ponto:

       - "comoPessoa" usa o token de quem está logado. Serve para
         descobrir QUEM é, respeitando todas as regras de segurança.
       - "comoServidor" usa a service_role, que passa por cima da RLS.
         Só ela pode escrever em promocoes e pagamentos, que não têm
         policy de escrita para ninguém.

       Misturar as duas é como se escreve um furo: se a criação da
       promoção usasse o token da pessoa, bastaria a RLS ter um buraco
       para alguém criar promoção para a vaga do vizinho.
       ----------------------------------------------------------------- */
    const autorizacao = req.headers.get('Authorization') || '';

    const comoPessoa = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: autorizacao } } },
    );

    const { data: { user }, error: erroAuth } = await comoPessoa.auth.getUser();

    if (erroAuth || !user) {
        return responder({ erro: 'Entre na sua conta para destacar uma vaga.' }, 401, origem);
    }

    /* "dados" é o pacote que o Payment Brick monta no navegador: o
       token do cartão, a bandeira, o e-mail do pagador. Não é conferido
       campo a campo aqui porque quem o valida é o Mercado Pago — e
       porque nada dentro dele decide preço nem dono. */
    let corpo: {
        republica_id?: string;
        plano?: string;
        metodo?: string;
        dados?: Record<string, unknown>;
    };
    try {
        corpo = await req.json();
    } catch {
        return responder({ erro: 'Pedido malformado.' }, 400, origem);
    }

    const republicaId = (corpo.republica_id || '').trim();
    const plano = (corpo.plano || '').trim();
    const metodo = (corpo.metodo || '').trim();
    const doForm = (corpo.dados || {}) as Record<string, any>;

    if (!republicaId || !plano) {
        return responder({ erro: 'Informe a vaga e o plano.' }, 400, origem);
    }

    if (!metodo) {
        return responder({ erro: 'Escolha a forma de pagamento.' }, 400, origem);
    }

    /* O grátis não passa por aqui. Ele não é uma compra de R$ 0 — é a
       ausência de compra. Deixar entrar criaria promoção e cobrança de
       zero real, lixo que depois apareceria no seu painel como venda. */
    if (plano === 'gratuito') {
        return responder({ erro: 'O plano grátis não precisa de pagamento.' }, 400, origem);
    }

    const comoServidor = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    /* -----------------------------------------------------------------
       O preço, lido do banco
       ----------------------------------------------------------------- */
    const { data: dadosPlano } = await comoServidor
        .from('planos')
        .select('slug, nome, preco_centavos, dias, ativo')
        .eq('slug', plano)
        .maybeSingle();

    if (!dadosPlano || !dadosPlano.ativo || dadosPlano.preco_centavos <= 0) {
        return responder({ erro: 'Plano indisponível.' }, 400, origem);
    }

    /* -----------------------------------------------------------------
       A vaga é dela?

       Conferido no servidor mesmo com a RLS existindo. A RLS protege a
       LEITURA e a ESCRITA da tabela republicas; ela não impede alguém
       de mandar para cá o id da vaga do vizinho e comprar um destaque
       em nome dele. Parece favor, e não é: seria uma cobrança no cartão
       de um, acendendo o anúncio de outro, sem ninguém para reclamar.
       ----------------------------------------------------------------- */
    const { data: vaga } = await comoServidor
        .from('republicas')
        .select('id, nome, dono_id, ativa, status')
        .eq('id', republicaId)
        .maybeSingle();

    if (!vaga || vaga.dono_id !== user.id) {
        return responder({ erro: 'Esta vaga não é sua.' }, 403, origem);
    }

    if (vaga.status !== 'publicada') {
        /* Não se cobra por destaque de um anúncio que não está sendo
           mostrado. Em revisão, o dinheiro entraria para comprar nada. */
        return responder({
            erro: 'Esta vaga está em revisão. Assim que for liberada, o destaque fica disponível.',
        }, 409, origem);
    }

    const { data: jaTem } = await comoServidor
        .from('promocoes')
        .select('id, plano, termina_em')
        .eq('republica_id', republicaId)
        .eq('status', 'ativa')
        .maybeSingle();

    if (jaTem) {
        return responder({
            erro: 'Esta vaga já está destacada até ' +
                  new Date(jaTem.termina_em).toLocaleDateString('pt-BR') +
                  '. Um destaque de cada vez.',
        }, 409, origem);
    }

    /* -----------------------------------------------------------------
       A promoção nasce apagada

       'aguardando' não destaca nada. Ela existe antes do pagamento
       porque o Mercado Pago precisa de uma referência nossa para dizer,
       depois, a qual compra aquele dinheiro pertence.
       ----------------------------------------------------------------- */
    const { data: promocao, error: erroPromocao } = await comoServidor
        .from('promocoes')
        .insert({
            republica_id: republicaId,
            dono_id: user.id,
            plano: dadosPlano.slug,
            preco_centavos: dadosPlano.preco_centavos,
            dias: dadosPlano.dias,
            status: 'aguardando',
        })
        .select()
        .single();

    if (erroPromocao || !promocao) {
        console.error('Falhou ao criar a promoção:', erroPromocao);
        return responder({ erro: 'Não consegui iniciar o pagamento. Tente de novo.' }, 500, origem);
    }

    /* -----------------------------------------------------------------
       A COBRANÇA

       external_reference é o fio que amarra tudo: é o id da promoção
       daqui, e é o que volta na notificação. Sem ele, o dinheiro chega
       e não há como saber qual vaga acender.

       transaction_amount vem de dadosPlano, lido da tabela linhas
       acima. NUNCA de "doForm" — é a única linha deste arquivo que não
       pode mudar sem alguém pensar duas vezes.
       ----------------------------------------------------------------- */
    const urlDoAviso = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercado-pago-avisa`;

    const cobranca: Record<string, unknown> = {
        transaction_amount: dadosPlano.preco_centavos / 100,
        description: `Destaque ${dadosPlano.nome} — ${vaga.nome} (até ${dadosPlano.dias} dias)`,
        payment_method_id: doForm.payment_method_id,

        /* O e-mail do formulário é aceito porque o Mercado Pago exige um
           pagador e quem paga pode não ser o dono da conta daqui — mas o
           dono da COMPRA é sempre user.id, gravado na promoção. */
        payer: doForm.payer,

        external_reference: promocao.id,
        notification_url: urlDoAviso,
        statement_descriptor: 'ACHEIREPUBLICA',
    };

    /* Cartão precisa do token e de uma parcela; Pix não usa nenhum dos
       dois, e mandar campo de cartão numa cobrança Pix faz o Mercado
       Pago recusar o pedido inteiro.

       Uma parcela sempre: doze vezes de um real e meio, num destaque de
       R$ 19,90, custa mais em taxa do que traz em conversão. */
    if (metodo === 'credit_card' || metodo === 'debit_card') {
        cobranca.token = doForm.token;
        cobranca.installments = 1;
        if (doForm.issuer_id) cobranca.issuer_id = doForm.issuer_id;
        if (doForm.payment_method_option_id) {
            cobranca.payment_method_option_id = doForm.payment_method_option_id;
        }
    }

    const resposta = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            /* Clique duplo, ou a rede repetindo o pedido, não viram duas
               cobranças: a chave é a promoção, que é nova a cada compra. */
            'X-Idempotency-Key': promocao.id,
        },
        body: JSON.stringify(cobranca),
    });

    const criada = await resposta.json().catch(() => null);

    if (!resposta.ok || !criada || !criada.id) {
        console.error('Mercado Pago recusou a cobrança:', JSON.stringify(criada));
        await comoServidor.from('promocoes')
            .update({ status: 'recusada', observacao: 'Falha ao cobrar no Mercado Pago.' })
            .eq('id', promocao.id);
        return responder({
            erro: 'Não consegui concluir o pagamento. Confira os dados e tente de novo.',
        }, 502, origem);
    }

    const situacao = String(criada.status || '');

    await comoServidor.from('pagamentos').insert({
        promocao_id: promocao.id,
        provedor: 'mercado_pago',
        valor_centavos: dadosPlano.preco_centavos,
        status: situacao,
        bruto: { pagamento_id: criada.id, status: situacao, metodo },
    });

    /* -----------------------------------------------------------------
       E o destaque, acende aqui?

       Não. Mesmo com "approved" na mão, quem acende é o webhook, que
       pergunta de volta ao Mercado Pago o que realmente aconteceu.

       Parece exagero — a resposta veio da API deles, autenticada com o
       nosso token. Mas o caminho fica um só, e um caminho só é um
       caminho que se entende: no Pix, "approved" não chega nesta
       resposta de jeito nenhum (o dinheiro cai depois), então a
       notificação teria de existir mesmo assim. Dois lugares acendendo
       destaque é onde nasce o destaque aceso duas vezes.
       ----------------------------------------------------------------- */
    const pix = criada.point_of_interaction?.transaction_data ?? null;

    return responder({
        promocao_id: promocao.id,
        status: situacao,
        aprovado: situacao === 'approved',
        pix_qr_base64: pix?.qr_code_base64 ?? null,
        pix_copia_e_cola: pix?.qr_code ?? null,
    }, 200, origem);
});
