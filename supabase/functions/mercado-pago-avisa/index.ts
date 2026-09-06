/* =====================================================================
   Achei República — o aviso do Mercado Pago

   Esta é a única porta por onde um destaque acende. E a regra que a
   governa cabe numa frase:

       NÃO ACREDITAMOS NO QUE CHEGA. PERGUNTAMOS.

   O Mercado Pago manda um aviso curto — "houve movimento no pagamento
   nº 123". Esse aviso é um bilhete anônimo: qualquer pessoa na internet
   pode fazer um POST idêntico para este endereço. Se a gente lesse o
   status de dentro dele, seria trivial escrever "approved" e ganhar 30
   dias de Pro sem pagar nada.

   Então são duas conferências, e cada uma pega uma coisa diferente:

   1. ASSINATURA. O cabeçalho x-signature traz um HMAC do id + horário,
      feito com um segredo que só nós e eles conhecemos. Sem assinatura
      válida, o bilhete é jogado fora sem nem ser lido.

   2. CONSULTA DE VOLTA. Mesmo com assinatura boa, o status vem da
      NOSSA chamada à API deles, com a chave secreta, perguntando
      "quanto foi pago no 123, e foi aprovado?". O corpo que chegou é
      usado só para saber QUAL pagamento consultar.

   E ainda uma terceira, que é sobre dinheiro e não sobre fraude:

   3. O VALOR CONFERE? Se o aprovado foi menor que o preço do plano, o
      destaque não acende. Cobrança adulterada por qualquer caminho
      morre aqui.

   ---------------------------------------------------------------------
   PUBLICAR SEM EXIGIR JWT

   O Mercado Pago não tem conta no Supabase e não manda token nenhum.
   Esta função precisa ir ao ar com a verificação desligada:

       supabase functions deploy mercado-pago-avisa --no-verify-jwt

   Desligar ali NÃO é abrir a porta: quem faz o papel do porteiro é a
   assinatura conferida aqui dentro.
   ===================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/* Sempre 200 para o Mercado Pago quando o bilhete foi entendido, mesmo
   que a gente decida não fazer nada com ele. Resposta de erro faz eles
   reenviarem o mesmo aviso por horas. */
const OK = () => new Response('ok', { status: 200 });

/* Compara dois textos em tempo constante. Numa comparação comum, o
   tempo até a resposta diz quantos caracteres bateram — e com isso se
   descobre uma assinatura válida, um caractere por vez. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diferenca = 0;
    for (let i = 0; i < a.length; i++) {
        diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diferenca === 0;
}

async function assinaturaConfere(req: Request, idDoPagamento: string): Promise<boolean> {
    const segredo = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
    if (!segredo) {
        console.error('MERCADO_PAGO_WEBHOOK_SECRET não configurado: recusando tudo.');
        return false;
    }

    const assinatura = req.headers.get('x-signature') || '';
    const idDoPedido = req.headers.get('x-request-id') || '';

    // Formato: "ts=1704908010,v1=618c8534..."
    const partes = Object.fromEntries(
        assinatura.split(',').map((p) => p.split('=').map((t) => t.trim())),
    );
    const ts = partes['ts'];
    const v1 = partes['v1'];
    if (!ts || !v1) return false;

    /* Aviso velho não vale. Sem esta janela, uma assinatura capturada
       uma vez serviria para sempre — bastaria reenviá-la depois de um
       estorno para reacender o destaque. Cinco minutos é o que o
       próprio Mercado Pago recomenda. */
    const idade = Math.abs(Date.now() - Number(ts));
    if (!Number.isFinite(idade) || idade > 5 * 60 * 1000) {
        console.error('Aviso fora da janela de tempo:', ts);
        return false;
    }

    const manifesto = `id:${idDoPagamento};request-id:${idDoPedido};ts:${ts};`;

    const chave = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(segredo),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const calculado = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(manifesto));
    const emHexa = [...new Uint8Array(calculado)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    return iguaisEmTempoConstante(emHexa, v1);
}

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('ok', { status: 200 });

    const token = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!token) {
        console.error('MERCADO_PAGO_ACCESS_TOKEN não configurado.');
        return new Response('sem token', { status: 500 });
    }

    let aviso: Record<string, unknown> = {};
    try {
        aviso = await req.json();
    } catch {
        /* Corpo vazio acontece: o Mercado Pago às vezes manda tudo pela
           URL. Não é erro. */
    }

    const endereco = new URL(req.url);
    const tipo = String(
        aviso.type || aviso.topic || endereco.searchParams.get('type') ||
        endereco.searchParams.get('topic') || '',
    );

    const idDoPagamento = String(
        (aviso.data as { id?: string })?.id ||
        endereco.searchParams.get('data.id') ||
        endereco.searchParams.get('id') || '',
    );

    /* Eles avisam sobre várias coisas (merchant_order, plan, invoice).
       Só pagamento interessa. Os outros recebem 200 e vão embora. */
    if (tipo !== 'payment' || !idDoPagamento) return OK();

    if (!(await assinaturaConfere(req, idDoPagamento))) {
        console.error('Assinatura inválida para o pagamento', idDoPagamento);
        return new Response('assinatura invalida', { status: 401 });
    }

    /* -----------------------------------------------------------------
       A pergunta de volta — a fonte da verdade
       ----------------------------------------------------------------- */
    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${idDoPagamento}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!consulta.ok) {
        console.error('Não consegui consultar o pagamento', idDoPagamento, await consulta.text());
        /* Aqui SIM devolvemos erro: queremos que eles reenviem. O
           problema foi nosso ou da rede, e o pagamento pode ser real. */
        return new Response('falha ao consultar', { status: 500 });
    }

    const pagamento = await consulta.json();

    const promocaoId = String(pagamento.external_reference || '');
    const situacao = String(pagamento.status || '');
    const metodo = String(pagamento.payment_method_id || pagamento.payment_type_id || '');
    const centavosPagos = Math.round(Number(pagamento.transaction_amount || 0) * 100);

    if (!promocaoId) {
        console.error('Pagamento sem external_reference:', idDoPagamento);
        return OK();
    }

    const comoServidor = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: promocao } = await comoServidor
        .from('promocoes')
        .select('id, preco_centavos, status')
        .eq('id', promocaoId)
        .maybeSingle();

    if (!promocao) {
        console.error('Aviso para promoção que não existe:', promocaoId);
        return OK();
    }

    /* Guarda a referência do pagamento antes de decidir qualquer coisa.
       Assim, mesmo que o resto falhe, existe rastro de que o dinheiro
       foi visto — e é por ele que você acha o caso quando alguém
       telefonar dizendo "paguei". */
    await comoServidor.from('pagamentos')
        .update({
            referencia: idDoPagamento,
            metodo,
            status: situacao === 'approved' ? 'aprovado' : 'pendente',
            bruto: pagamento,
        })
        .eq('promocao_id', promocaoId)
        .is('referencia', null);

    if (situacao !== 'approved') {
        await comoServidor.rpc('recusar_promocao', {
            p_promocao: promocaoId,
            p_referencia: idDoPagamento,
            p_situacao: situacao,
            p_bruto: pagamento,
        });
        return OK();
    }

    /* -----------------------------------------------------------------
       Terceira conferência: o valor

       Aprovado, mas aprovado de quanto? Só acende se pagou o preço
       congelado na promoção. Pagou menos, fica registrado e não acende
       — e aparece no seu painel para você resolver com a pessoa.
       ----------------------------------------------------------------- */
    if (centavosPagos < promocao.preco_centavos) {
        console.error(
            `Valor menor que o plano na promoção ${promocaoId}: ` +
            `pago ${centavosPagos}, esperado ${promocao.preco_centavos}`,
        );
        await comoServidor.from('promocoes')
            .update({
                observacao: `Pagamento de R$ ${(centavosPagos / 100).toFixed(2)} ` +
                            `menor que o plano (R$ ${(promocao.preco_centavos / 100).toFixed(2)}). ` +
                            `Nao acendido automaticamente.`,
            })
            .eq('id', promocaoId);
        return OK();
    }

    const { error } = await comoServidor.rpc('ativar_promocao', {
        p_promocao: promocaoId,
        p_referencia: idDoPagamento,
        p_metodo: metodo,
        p_bruto: pagamento,
    });

    if (error) {
        console.error('Falhou ao ativar a promoção', promocaoId, error);
        /* 500 de propósito: o dinheiro entrou e o destaque não acendeu.
           Queremos o reenvio. */
        return new Response('falha ao ativar', { status: 500 });
    }

    console.log('Destaque aceso para a promoção', promocaoId);
    return OK();
});
