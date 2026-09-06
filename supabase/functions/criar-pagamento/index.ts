/* =====================================================================
   Achei República — criar a cobrança do destaque

   Roda no Supabase (Edge Function), e não no navegador. É a diferença
   entre um preço que o servidor decide e um preço que o cliente
   informa.

   O QUE ENTRA:  { republica_id, plano }   e o token de quem está logado
   O QUE SAI:    { url }                   o endereço do Mercado Pago

   Repare no que NÃO entra: o valor. O navegador manda o APELIDO do
   plano ('premium'), nunca o preço. Quem lê 3990 é esta função, na
   tabela planos. Se o preço viesse de fora, trocar 3990 por 1 no
   console compraria o Premium por um centavo — e a cobrança seria
   legítima do ponto de vista do Mercado Pago, porque foi a nossa
   própria função que pediu.

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

/* O endereço para onde a pessoa volta depois de pagar. O painel dela é
   o cadastro de vagas — é lá que o destaque vai aparecer aceso. */
const VOLTA_PARA = 'https://acheirepublica.com.br/cadastrar-vaga.html';

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

    let corpo: { republica_id?: string; plano?: string };
    try {
        corpo = await req.json();
    } catch {
        return responder({ erro: 'Pedido malformado.' }, 400, origem);
    }

    const republicaId = (corpo.republica_id || '').trim();
    const plano = (corpo.plano || '').trim();

    if (!republicaId || !plano) {
        return responder({ erro: 'Informe a vaga e o plano.' }, 400, origem);
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
       A preferência no Mercado Pago

       external_reference é o fio que amarra tudo: é o id da promoção
       daqui, e é o que volta na notificação. Sem ele, o dinheiro chega
       e não há como saber qual vaga acender.
       ----------------------------------------------------------------- */
    const urlDoAviso = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercado-pago-avisa`;

    const preferencia = {
        items: [{
            id: dadosPlano.slug,
            title: `Destaque ${dadosPlano.nome} — ${vaga.nome}`,
            description: `Até ${dadosPlano.dias} dias de destaque. Pagamento único, sem renovação.`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: dadosPlano.preco_centavos / 100,
        }],
        payer: { email: user.email },
        external_reference: promocao.id,
        notification_url: urlDoAviso,
        statement_descriptor: 'ACHEIREPUBLICA',
        back_urls: {
            success: `${VOLTA_PARA}?pagamento=aprovado`,
            pending: `${VOLTA_PARA}?pagamento=pendente`,
            failure: `${VOLTA_PARA}?pagamento=falhou`,
        },
        auto_return: 'approved',
        /* Nada de parcelamento em compra de R$ 19,90: doze vezes de um
           real e meio custa mais em taxa do que traz em conversão. */
        payment_methods: { installments: 1 },
    };

    const resposta = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            /* Se a pessoa clicar duas vezes, o Mercado Pago devolve a
               MESMA preferência em vez de criar duas cobranças. */
            'X-Idempotency-Key': promocao.id,
        },
        body: JSON.stringify(preferencia),
    });

    const criada = await resposta.json();

    if (!resposta.ok || !criada.id) {
        console.error('Mercado Pago recusou a preferência:', criada);
        await comoServidor.from('promocoes')
            .update({ status: 'recusada', observacao: 'Falha ao criar a cobrança no Mercado Pago.' })
            .eq('id', promocao.id);
        return responder({ erro: 'Não consegui abrir o pagamento. Tente de novo em instantes.' }, 502, origem);
    }

    await comoServidor.from('pagamentos').insert({
        promocao_id: promocao.id,
        provedor: 'mercado_pago',
        valor_centavos: dadosPlano.preco_centavos,
        status: 'criado',
        bruto: { preferencia_id: criada.id },
    });

    /* init_point é produção; sandbox_init_point é o ambiente de teste.
       Enquanto o token for de teste, só o segundo funciona — e é por
       isso que os dois vão na resposta. */
    return responder({
        url: criada.init_point || criada.sandbox_init_point,
        promocao_id: promocao.id,
    }, 200, origem);
});
