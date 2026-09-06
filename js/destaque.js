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
            'Selo ⭐ Destaque no anúncio',
            'Moldura e cor que separam sua vaga das outras',
            'Passa à frente de anúncios equivalentes nos resultados',
            'Mais exposição para quem filtrou o que você tem',
        ],
        botao: 'Destacar por até 30 dias',
    },
    premium: {
        objetivo: 'Mais exposição + recursos',
        periodo: 'Até 30 dias de destaque',
        etiqueta: '🔥 MAIS ESCOLHIDO',
        itens: [
            'Tudo do Destaque, com evidência maior',
            'Selo 🔥 Premium',
            'Prioridade acima do plano Destaque nos resultados',
            'Estatísticas completas: de onde vieram as visitas',
            'Quantos chegaram pelos filtros e pelo questionário',
            'Espaço nas áreas especiais da página da cidade',
        ],
        botao: 'Destacar por até 30 dias',
    },
    pro: {
        objetivo: 'Máxima exposição',
        periodo: 'Até 30 dias de destaque',
        etiqueta: 'MAIOR EXPOSIÇÃO',
        itens: [
            'Tudo do Premium, no nível mais alto',
            'Selo 👑 Pro',
            'Prioridade máxima entre os resultados compatíveis',
            'Destaque especial para vagas com entrada imediata',
            'Estatísticas avançadas e relatório do período',
            'Atendimento prioritário no WhatsApp',
            'Até 2 divulgações nas redes do Achei República',
        ],
        botao: 'Destacar por até 30 dias',
    },
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
            Você será levado ao Mercado Pago para pagar com Pix ou cartão.
            Seus dados de pagamento não passam pelo Achei República.
          </p>
        </div>`;

    const fechar = () => {
        janela.remove();
        document.body.style.overflow = '';
        botao.focus();
    };

    janela.querySelector('[data-fechar]').addEventListener('click', fechar);
    janela.addEventListener('click', e => { if (e.target === janela) fechar(); });
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { fechar(); document.removeEventListener('keydown', esc); }
    });

    janela.querySelector('[data-pagar]').addEventListener('click', e => {
        pagar(plano, e.currentTarget, fechar);
    });

    document.body.appendChild(janela);
    document.body.style.overflow = 'hidden';
    janela.querySelector('[data-pagar]').focus();
}


/* ---------------------------------------------------------------------
   Pagar

   Manda vaga e plano para a função de borda e leva a pessoa para o
   endereço que ela devolver. O que NÃO vai nesta chamada é o valor —
   ver o cabeçalho do arquivo.
   --------------------------------------------------------------------- */
async function pagar(plano, botao, fechar) {
    ocupado(botao, true, 'Abrindo o pagamento...');

    try {
        const { data: sessao } = await banco.auth.getSession();
        if (!sessao.session) {
            fechar();
            return recado('Sua sessão expirou. Entre de novo para continuar.');
        }

        const resposta = await fetch(
            `${window.CONFIG_SUPABASE.url}/functions/v1/criar-pagamento`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessao.session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ republica_id: vaga.id, plano: plano.slug }),
            },
        );

        const corpo = await resposta.json();

        if (!resposta.ok || !corpo.url) {
            fechar();
            return recado(corpo.erro || 'Não consegui abrir o pagamento. Tente de novo.');
        }

        /* Substitui a página em vez de empilhar: assim o "voltar" do
           navegador, depois de pagar, não devolve a pessoa para a tela
           de confirmação — que a faria achar que precisa pagar de novo. */
        location.replace(corpo.url);
    } catch (erro) {
        ocupado(botao, false);
        fechar();
        recado('Não consegui falar com o servidor. Confira a internet e tente de novo.');
        console.error('Falha ao criar o pagamento:', erro);
    }
}


iniciar();
