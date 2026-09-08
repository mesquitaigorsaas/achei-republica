/* =====================================================================
   Achei República — a tela de planos, e a contratação do destaque

   O banco, o menu do celular, a caixa de recados e o ocupado() vêm do
   js/conta.js, carregado antes deste. Não recriar nada disso aqui: ele
   já declara "banco" no escopo global, e um segundo const com o mesmo
   nome quebra a página inteira.

   ---------------------------------------------------------------------
   O CAMINHO DO DINHEIRO, EM QUATRO PASSOS

   1. Esta página manda para o servidor só DUAS coisas: qual vaga e
      qual plano. Nunca o preço.
   2. A função de borda (supabase/functions/criar-pagamento) lê o preço
      na tabela, confere que a vaga é de quem está pedindo, cria a
      promoção apagada e abre a cobrança no Mercado Pago.
   3. A pessoa paga lá, no ambiente deles. Nenhum dado de cartão passa
      por aqui.
   4. O Mercado Pago avisa o nosso servidor, que PERGUNTA DE VOLTA se
      aquilo foi mesmo aprovado, e só então acende o destaque.

   Em nenhum momento o navegador diz que algo foi pago. Ele nem é
   consultado sobre isso.
   ===================================================================== */

const grade = document.getElementById('grade');
const carregando = document.getElementById('carregandoPlanos');
const caixaVaga = document.getElementById('vagaEscolhida');
const nomeDaVaga = document.getElementById('nomeDaVaga');

let usuario = null;
let vaga = null;
let planos = [];


/* ---------------------------------------------------------------------
   O QUE CADA PLANO ENTREGA

   Texto comercial, e por isso mora no código e não no banco: mudar uma
   frase de venda não deve exigir mexer em tabela, e o preço — que é o
   que precisa ser inviolável — continua vindo de lá.

   Cada plano inclui tudo do anterior. A lista não repete o que já foi
   dito acima: quem lê três colunas com as mesmas seis linhas não
   compara nada, só cansa.
   --------------------------------------------------------------------- */
const ENTREGA = {
    gratuito: {
        objetivo: 'Estar na plataforma',
        periodo: 'Enquanto a vaga estiver disponível',
        itens: [
            'Sua república e sua vaga cadastradas',
            'Preço, localização, faculdade e regras da casa',
            'Estrutura, características e até 6 fotos',
            'Aparece nas buscas e participa de todos os filtros',
            'Contato direto pelo seu WhatsApp',
            'Quantas pessoas viram e chamaram',
        ],
        botao: 'Cadastrar minha vaga',
    },
    destaque: {
        objetivo: 'Aumentar a visibilidade',
        periodo: 'Até 30 dias de destaque',
        itens: [
            'Selo 🥈 Destaque no anúncio',
            'Moldura prateada, que separa sua vaga das outras',
            'Passa à frente de anúncios equivalentes nos resultados',
            'Mais exposição para quem filtrou o que você tem',
        ],
        botao: 'Destacar por até 30 dias',
    },
    premium: {
        objetivo: 'Máxima exposição',
        periodo: 'Até 30 dias de destaque',
        /* "Mais completo" e não "mais escolhido": ninguém escolheu nada
           ainda, e inventar comportamento de outros clientes é a mesma
           mentira dos recursos que não existiam. Completo é verificável
           — é o de cima da lista. */
        etiqueta: '🥇 MAIS COMPLETO',
        itens: [
            'Tudo do Destaque, com evidência maior',
            'Selo 🥇 Premium e moldura dourada',
            'Prioridade máxima entre os anúncios compatíveis',
            'Estatísticas completas: de onde vieram as visitas',
            'Quantos chegaram pelos filtros e pelo questionário',
        ],
        botao: 'Destacar por até 30 dias',
    },
    /* O Pro saiu em 08/09/2026, e não por preço: quatro planos são uma
       tabela, três são uma frase. Grátis, mais visível, mais visível
       ainda — isso se explica no balcão sem papel na mão.

       Ele já vinha esvaziando. Cinco promessas caíram em duas levas:
       área especial na página da cidade, faixa de entrada imediata e
       relatório do período nunca existiram; atendimento prioritário e
       divulgação nas redes eram possíveis, mas dependiam de mão humana
       — e promessa que depende de alguém lembrar não é recurso, é
       dívida com o cliente. Sem elas, o Pro entregava sobre o Premium
       só o selo e a ordem, por R$ 20. Não sustentava o próprio degrau.

       O que era dele agora é do Premium: a prioridade máxima e o selo
       de cima, que virou o ouro. */
};


/* ---------------------------------------------------------------------
   Carregar

   Os planos vêm do banco mesmo para quem não está logado: a tabela de
   preços é para ser lida antes de decidir criar conta. Esconder o preço
   atrás do login é o tipo de coisa que faz a pessoa fechar a aba.
   --------------------------------------------------------------------- */
async function iniciar() {
    if (!banco) {
        carregando.textContent = 'O site ainda não está ligado ao banco.';
        return;
    }

    const { data: sessao } = await banco.auth.getSession();
    usuario = sessao.session ? sessao.session.user : null;

    const { data, error } = await banco
        .from('planos')
        .select('slug, nome, preco_centavos, dias, selo, chamada, ordem, ativo')
        .eq('ativo', true)
        .order('ordem');

    if (error || !data || !data.length) {
        console.error('Falhou ao carregar os planos:', error);
        carregando.textContent =
            'Não consegui carregar os planos agora. Recarregue a página em instantes.';
        return;
    }

    planos = data;
    await descobrirVaga();
    desenharPlanos();
}


/* ---------------------------------------------------------------------
   Qual vaga vai ser destacada

   Três caminhos, e a página não pergunta nada quando não precisa:

   - veio do painel com ?vaga=<id>: é essa;
   - a pessoa tem uma vaga só: é essa, sem perguntar;
   - tem mais de uma: aí sim escolhe.

   Sem login, nada disso acontece — e está certo: a pessoa ainda está
   lendo os preços, e pedir conta antes de ela decidir é pedir cedo
   demais.
   --------------------------------------------------------------------- */
async function descobrirVaga() {
    if (!usuario) return;

    const pedida = new URLSearchParams(location.search).get('vaga');

    const { data } = await banco
        .from('republicas')
        .select('id, nome, ativa, status, destaque, destaque_ate')
        .eq('dono_id', usuario.id)
        .order('criada_em', { ascending: false });

    const minhas = data || [];
    if (!minhas.length) return;

    // Só vaga no ar e publicada pode ser destacada: pagar por
    // visibilidade de um anúncio que não está sendo mostrado seria
    // vender o que não existe.
    const elegiveis = minhas.filter(v => v.ativa && v.status === 'publicada');

    vaga = (pedida && elegiveis.find(v => v.id === pedida)) ||
           (elegiveis.length === 1 ? elegiveis[0] : null);

    if (vaga) {
        nomeDaVaga.textContent = vaga.nome;
        caixaVaga.hidden = false;
    } else if (elegiveis.length > 1) {
        montarEscolhaDeVaga(elegiveis);
    }
}

function montarEscolhaDeVaga(elegiveis) {
    const escolha = document.createElement('select');
    escolha.className = 'planos-escolher-vaga';
    escolha.setAttribute('aria-label', 'Qual vaga você quer destacar');

    escolha.append(...elegiveis.map(v => {
        const o = document.createElement('option');
        o.value = v.id;
        o.textContent = v.nome;
        return o;
    }));

    escolha.addEventListener('change', () => {
        vaga = elegiveis.find(v => v.id === escolha.value) || null;
    });

    vaga = elegiveis[0];
    nomeDaVaga.replaceChildren(escolha);
    caixaVaga.hidden = false;
}


/* ---------------------------------------------------------------------
   Os cartões
   --------------------------------------------------------------------- */
function desenharPlanos() {
    grade.replaceChildren(...planos.map(cartaoDoPlano));
    continuarDaHome();
}


/* ---------------------------------------------------------------------
   Ela já escolheu o plano lá atrás

   Vem do painel da home com ?plano=, e às vezes depois de cadastrar a
   vaga inteira. Reabrir a mesma pergunta aqui — "qual plano você quer?"
   — é pedir de novo a decisão que ela já tomou duas telas atrás.

   Então a confirmação abre sozinha. Só a confirmação: o que ela vê é o
   valor, o prazo e as três frases sobre não ser assinatura, com o
   caminho fácil sendo desistir.
   --------------------------------------------------------------------- */
function continuarDaHome() {
    const escolhido = new URLSearchParams(location.search).get('plano');
    if (!escolhido || escolhido === 'gratuito' || !vaga) return;

    const plano = planos.find(p => p.slug === escolhido && p.preco_centavos > 0);
    if (!plano) return;

    // Some do endereço: recarregar não deve reabrir a caixa sozinho.
    const limpa = new URL(location.href);
    limpa.searchParams.delete('plano');
    history.replaceState(null, '', limpa);

    const cartao = grade.querySelector('.plano-' + plano.slug);
    const botao = cartao && cartao.querySelector('.plano-botao');
    if (!botao) return;

    cartao.scrollIntoView({ block: 'center', behavior: 'smooth' });
    confirmar(plano, botao);
}

function cartaoDoPlano(plano) {
    const entrega = ENTREGA[plano.slug] || { itens: [], botao: 'Escolher' };
    const gratis = plano.preco_centavos === 0;

    const cartao = document.createElement('article');
    cartao.className = 'plano plano-' + plano.slug;
    if (plano.slug === 'premium') cartao.classList.add('plano-realce');

    if (entrega.etiqueta) {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'plano-etiqueta';
        etiqueta.textContent = entrega.etiqueta;
        cartao.appendChild(etiqueta);
    }

    const nome = document.createElement('h2');
    nome.className = 'plano-nome';
    nome.textContent = plano.selo ? `${plano.selo} ${plano.nome}` : plano.nome;

    const objetivo = document.createElement('p');
    objetivo.className = 'plano-objetivo';
    objetivo.textContent = entrega.objetivo || plano.chamada || '';

    /* O PREÇO E O PERÍODO, e a regra que não pode ser quebrada aqui:
       nunca "/mês". O valor numa linha, "até 30 dias" na linha de
       baixo, e a palavra "único" logo abaixo do valor.

       Escrever R$ 39,90/mês seria mentira — não existe segunda
       cobrança — e é o tipo de mentira que a pessoa descobre no
       extrato, quando já não confia mais em nada do site. */
    const preco = document.createElement('div');
    preco.className = 'plano-preco';
    preco.textContent = gratis ? 'R$ 0' : emReais(plano.preco_centavos);

    const periodo = document.createElement('p');
    periodo.className = 'plano-periodo';
    periodo.textContent = gratis
        ? entrega.periodo
        : `Destaque por até ${plano.dias} dias`;

    const unico = document.createElement('p');
    unico.className = 'plano-unico';
    unico.textContent = gratis
        ? 'Sempre gratuito'
        : 'Pagamento único · não renova';

    const itens = document.createElement('ul');
    itens.className = 'plano-itens';
    itens.append(...entrega.itens.map(texto => {
        const li = document.createElement('li');
        li.textContent = texto;
        return li;
    }));

    cartao.append(nome, objetivo, preco, periodo, unico, itens, botaoDoPlano(plano, entrega));
    return cartao;
}

function botaoDoPlano(plano, entrega) {
    /* O grátis não tem botão de pagar — tem o caminho de cadastrar. É a
       diferença entre um plano e um degrau: ninguém "compra" o grátis,
       a pessoa simplesmente anuncia. */
    if (plano.preco_centavos === 0) {
        const link = document.createElement('a');
        link.className = 'btn btn-linha plano-botao';
        link.href = 'cadastrar-vaga.html';
        link.textContent = entrega.botao;
        return link;
    }

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn btn-azul plano-botao';
    botao.textContent = entrega.botao;
    botao.addEventListener('click', () => confirmar(plano, botao));
    return botao;
}


/* ---------------------------------------------------------------------
   A CONFIRMAÇÃO

   Uma tela entre o clique e a cobrança, com o valor por extenso e as
   três frases que a pessoa precisa ter lido ANTES de pagar, e não
   depois. É o pedido do enunciado, e é também o contrário de um dark
   pattern: o caminho fácil aqui é desistir, não continuar.
   --------------------------------------------------------------------- */
function confirmar(plano, botao) {
    limparRecado();

    if (!usuario) {
        return recado('Entre na sua conta para destacar uma vaga. '
            + 'É a mesma conta que você usa para anunciar.');
    }

    if (!vaga) {
        return recado('Você ainda não tem uma vaga no ar para destacar. '
            + 'Cadastre a vaga primeiro — é gratuito.');
    }

    const janela = document.createElement('div');
    janela.className = 'planos-confirmar';
    janela.innerHTML = `
        <div class="planos-confirmar-caixa" role="dialog" aria-modal="true"
             aria-labelledby="tituloConfirmar">
          <h2 id="tituloConfirmar">Confirmar o destaque</h2>

          <dl class="planos-resumo">
            <div><dt>Vaga</dt><dd>${vaga.nome}</dd></div>
            <div><dt>Plano</dt><dd>${plano.selo || ''} ${plano.nome}</dd></div>
            <div><dt>Período</dt><dd>Até ${plano.dias} dias</dd></div>
            <div class="planos-total">
              <dt>Total</dt><dd>${emReais(plano.preco_centavos)}</dd>
            </div>
          </dl>

          <ul class="planos-avisos">
            <li>Pagamento único. Não é assinatura e não há renovação automática.</li>
            <li>Encontrou um morador antes dos 30 dias? Basta marcar a vaga
                como preenchida — o destaque para junto.</li>
            <li>Este destaque vale só para esta vaga. Uma vaga futura
                começa gratuita.</li>
          </ul>

          <div class="planos-confirmar-acoes">
            <button type="button" class="btn btn-linha" data-fechar>Voltar</button>
            <button type="button" class="btn btn-azul" data-pagar>
              Pagar ${emReais(plano.preco_centavos)}
            </button>
          </div>

          <p class="planos-selo-mp">
            O pagamento é processado pelo Mercado Pago, aqui mesmo nesta
            página. O número do seu cartão não passa pelo Achei República.
          </p>
        </div>`;

    const fechar = () => {
        janela.remove();
        document.body.style.overflow = '';
        document.documentElement.classList.remove('com-janela');
        botao.focus();
    };

    janela.querySelector('[data-fechar]').addEventListener('click', fechar);

    /* Fechar sem querer some com a caixa, e enquanto ela só confirma
       isso não custa nada. Depois que o formulário de cartão está na
       tela, custa: um clique no escuro apagaria os dados já digitados,
       e a pessoa não saberia se chegou a ser cobrada. A partir dali só
       o "Cancelar" fecha. */
    const podeFechar = () => janela.dataset.pagando !== '1';

    janela.addEventListener('click', e => {
        if (e.target === janela && podeFechar()) fechar();
    });
    document.addEventListener('keydown', function esc(e) {
        if (e.key !== 'Escape' || !podeFechar()) return;
        fechar();
        document.removeEventListener('keydown', esc);
    });

    janela.querySelector('[data-pagar]').addEventListener('click', e => {
        pagar(plano, e.currentTarget, fechar, janela);
    });

    document.body.appendChild(janela);
    document.body.style.overflow = 'hidden';

    /* Cinto e suspensório, e não desconfiança do z-index: enquanto a
       caixa está aberta, o cabeçalho DESCE de camada por classe no
       <html>. z-index só compara elementos dentro do mesmo contexto de
       empilhamento, e basta um ancestral ganhar transform, filter ou
       opacity um dia para o 220 daqui virar 220 dentro de uma caixinha
       que inteira vale menos que a barra do topo. Esta linha não tem
       esse pressuposto.

       E resolve outra coisa junto: com o cabeçalho atrás da cortina,
       ninguém mais clica em "Sair" sem querer no meio de um pagamento. */
    document.documentElement.classList.add('com-janela');

    /* O preventScroll não é preciosismo. Desde que a caixa passou a
       rolar por dentro (para caber em tela baixa), focar um botão que
       está lá embaixo ARRASTA a caixa até ele — e o título "Confirmar
       o destaque" sumia cortado na borda de cima. O foco continua no
       Pagar, para quem navega pelo teclado; quem rola é ninguém. */
    janela.querySelector('[data-pagar]').focus({ preventScroll: true });
    janela.querySelector('.planos-confirmar-caixa').scrollTop = 0;
}


/* =====================================================================
   O PAGAMENTO, DENTRO DA PÁGINA

   O caminho antigo mandava a pessoa para o checkout do Mercado Pago,
   onde ela encarava uma tela pedindo login deles antes de ver qualquer
   campo. Agora o formulário é deles mas mora aqui — é o Payment Brick.

   O número do cartão NUNCA passa pelo nosso servidor: o componente o
   troca por um token, no navegador de quem está comprando, usando a
   chave pública. É esse token que a função de borda usa para cobrar, e
   ele serve para uma cobrança e nada mais.
   ===================================================================== */

const SDK_MERCADO_PAGO = 'https://sdk.mercadopago.com/js/v2';

function chaveDoMercadoPago() {
    const cfg = window.CONFIG_MERCADO_PAGO || {};
    const chave = cfg.chavePublica || '';
    return chave.startsWith('COLE_AQUI') ? '' : chave;
}

/* Carrega o SDK deles uma vez só, e só quando alguém decide pagar. Na
   entrada da página seria peso puro: a maioria vem ler preço e sair. */
let sdkCarregando = null;

function carregarSDK() {
    if (window.MercadoPago) return Promise.resolve();
    if (sdkCarregando) return sdkCarregando;

    sdkCarregando = new Promise((resolver, recusar) => {
        const script = document.createElement('script');
        script.src = SDK_MERCADO_PAGO;
        script.onload = () => resolver();
        script.onerror = () => recusar(new Error('SDK do Mercado Pago não carregou'));
        document.head.appendChild(script);
    });

    return sdkCarregando;
}


/* ---------------------------------------------------------------------
   Pagar

   Troca a caixa de confirmação pelo formulário de pagamento, sem sair
   da página. O que NÃO vai nesta chamada é o valor — ver o cabeçalho
   do arquivo.
   --------------------------------------------------------------------- */
async function pagar(plano, botao, fechar, janela) {
    const chave = chaveDoMercadoPago();

    /* Sem chave não existe formulário, e um formulário que não completa
       é pior do que dizer a verdade: a pessoa preenche o cartão inteiro
       para ouvir um erro no fim. */
    if (!chave) {
        fechar();
        return recado('O pagamento do destaque ainda não está disponível. '
            + 'Sua vaga continua no ar gratuitamente — e assim que ligarmos, '
            + 'o destaque aparece no seu painel.');
    }

    ocupado(botao, true, 'Abrindo o pagamento...');

    const { data: sessao } = await banco.auth.getSession();
    if (!sessao.session) {
        fechar();
        return recado('Sua sessão expirou. Entre de novo para continuar.');
    }

    try {
        await carregarSDK();
    } catch (erro) {
        ocupado(botao, false);
        fechar();
        console.error(erro);
        return recado('Não consegui carregar o pagamento. Confira a internet e tente de novo.');
    }

    mostrarFormulario(janela, plano, sessao.session.access_token);
}


/* ---------------------------------------------------------------------
   O formulário

   Substitui o conteúdo da mesma caixa em vez de abrir outra por cima:
   duas janelas empilhadas, com o Esc fechando a de cima, é como se
   perde alguém no meio de uma compra.
   --------------------------------------------------------------------- */
function mostrarFormulario(janela, plano, tokenDaSessao) {
    const caixa = janela.querySelector('.planos-confirmar-caixa');
    janela.dataset.pagando = '1';
    /* O formulário do Mercado Pago é mais alto que a confirmação, e ele
       mesmo dá foco a um campo ao montar. Sem isto, a caixa nasce rolada
       e o "Pagar R$ 19,90" do título fica fora da tela. */
    caixa.scrollTop = 0;

    caixa.innerHTML = `
        <h2>Pagar ${emReais(plano.preco_centavos)}</h2>
        <p class="planos-pagar-alvo">
          ${plano.selo || ''} ${plano.nome} · ${vaga.nome} · até ${plano.dias} dias
        </p>
        <p class="planos-pagar-erro" id="erroPagamento" role="alert" hidden></p>
        <div id="caixaDoBrick"></div>
        <button type="button" class="btn btn-linha planos-pagar-desistir" data-fechar>
          Cancelar
        </button>`;

    caixa.querySelector('[data-fechar]').addEventListener('click', () => {
        janela.remove();
        document.body.style.overflow = '';
    });

    const erro = caixa.querySelector('#erroPagamento');
    const mostrarErro = texto => {
        erro.textContent = texto;
        erro.hidden = false;
    };

    const mp = new window.MercadoPago(chaveDoMercadoPago(), { locale: 'pt-BR' });

    mp.bricks().create('payment', 'caixaDoBrick', {
        /* O valor aqui é só o que a pessoa VÊ. Quem cobra lê o preço na
           tabela planos, do lado do servidor — trocar este número no
           console não muda um centavo do que é cobrado. */
        initialization: { amount: plano.preco_centavos / 100 },
        customization: {
            paymentMethods: {
                creditCard: 'all',
                debitCard: 'all',
                /* Pix. Só aparece se a conta do Mercado Pago tiver Pix
                   habilitado — em conta de teste normalmente não tem. */
                bankTransfer: 'all',
                maxInstallments: 1,
            },
            visual: { hideFormTitle: true },
        },
        callbacks: {
            onReady: () => {},
            onError: e => {
                console.error('[brick]', e);
                mostrarErro('Confira os dados e tente de novo.');
            },
            onSubmit: async ({ selectedPaymentMethod, formData }) => {
                erro.hidden = true;

                const resultado = await cobrar(plano, selectedPaymentMethod,
                                               formData, tokenDaSessao);

                if (resultado.erro) {
                    mostrarErro(resultado.erro);
                    /* Recusar a promessa devolve o formulário ao estado
                       de edição, para a pessoa corrigir e tentar de
                       novo. Resolver deixaria a tela travada em
                       "processando" para sempre. */
                    throw new Error(resultado.erro);
                }

                mostrarDesfecho(caixa, resultado);
            },
        },
    });
}


async function cobrar(plano, metodo, formData, tokenDaSessao) {
    try {
        const resposta = await fetch(
            `${window.CONFIG_SUPABASE.url}/functions/v1/criar-pagamento`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenDaSessao}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    republica_id: vaga.id,
                    plano: plano.slug,
                    metodo,
                    dados: formData,
                }),
            },
        );

        const corpo = await resposta.json().catch(() => null);

        if (!resposta.ok || !corpo) {
            return { erro: (corpo && corpo.erro) || 'Não consegui concluir o pagamento.' };
        }

        return corpo;
    } catch (e) {
        console.error('Falha ao cobrar:', e);
        return { erro: 'Não consegui falar com o servidor. Confira a internet.' };
    }
}


/* ---------------------------------------------------------------------
   Depois de pagar

   Três desfechos, e nenhum deles diz "pronto, está destacado": quem
   acende o destaque é a notificação que chega do Mercado Pago no nosso
   servidor, e ela leva alguns segundos. Prometer aqui o que ainda não
   aconteceu é criar a dúvida que faz a pessoa pagar duas vezes.
   --------------------------------------------------------------------- */
/* O ?pagamento= no endereço não é enfeite: é ele que faz o painel
   avisar "o destaque acende em alguns segundos" e olhar sozinho três
   vezes, em vez de mostrar "vaga gratuita" para quem acabou de pagar.
   Sem isso, a pessoa acha que não deu certo e paga de novo. */
function painel(situacao) {
    return `<a class="btn btn-azul" href="cadastrar-vaga.html?pagamento=${situacao}">
              Ir para o meu painel
            </a>`;
}

function mostrarDesfecho(caixa, r) {
    if (r.pix_qr_base64 || r.pix_copia_e_cola) return mostrarPix(caixa, r);

    if (r.aprovado) {
        caixa.innerHTML = `
            <h2>Pagamento aprovado</h2>
            <p class="planos-pagar-alvo">
              O destaque acende em alguns segundos, sozinho. Você não
              precisa fazer mais nada.
            </p>${painel('aprovado')}`;
        return;
    }

    caixa.innerHTML = `
        <h2>Pagamento em análise</h2>
        <p class="planos-pagar-alvo">
          O banco está conferindo. Assim que aprovar, o destaque acende
          sozinho — e não há nada para pagar de novo.
        </p>${painel('pendente')}`;
}


function mostrarPix(caixa, r) {
    caixa.innerHTML = `
        <h2>Pague com Pix</h2>
        <p class="planos-pagar-alvo">
          Abra o aplicativo do seu banco, escolha Pix e leia o código.
          O destaque acende sozinho assim que o pagamento cair.
        </p>
        ${r.pix_qr_base64
            ? `<img class="planos-pix-qr" alt="Código QR do Pix"
                    src="data:image/png;base64,${r.pix_qr_base64}" />`
            : ''}
        <div id="pixCopia"></div>
        ${painel('pendente')}`;

    /* Quem está pagando pelo celular não consegue ler o QR da própria
       tela. Para esses, o copia e cola é o único caminho. */
    if (!r.pix_copia_e_cola) return;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn btn-azul planos-pix-copiar';
    botao.textContent = 'Copiar código do Pix';
    botao.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(r.pix_copia_e_cola);
            botao.textContent = 'Código copiado';
        } catch {
            botao.textContent = 'Não consegui copiar — selecione o código abaixo';
            const campo = document.createElement('textarea');
            campo.className = 'planos-pix-texto';
            campo.readOnly = true;
            campo.value = r.pix_copia_e_cola;
            botao.after(campo);
            campo.select();
        }
    });

    caixa.querySelector('#pixCopia').appendChild(botao);
}


iniciar();
