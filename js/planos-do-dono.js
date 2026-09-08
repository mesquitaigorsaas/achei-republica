/* =====================================================================
   Achei República — os quatro planos dentro do painel da home

   O botão "Anunciar vaga" do cabeçalho leva à seção #anunciar, e ela
   precisa responder ali mesmo a pergunta de quem tem uma vaga vazia:
   quanto custa. Antes essa resposta estava a dois cliques de distância,
   numa página que quase ninguém abria.

   ---------------------------------------------------------------------
   O PREÇO VEM DO BANCO

   Mesma regra da planos.html e da função de cobrança: a tabela "planos"
   é a autoridade. Escrito aqui, bastaria um reajuste no banco para a
   home passar a anunciar um valor que a cobrança não pratica.

   ---------------------------------------------------------------------
   POR QUE UM IIFE

   Este arquivo divide a página com o vitrine.js, o denuncia.js, o
   script.js e o planos.js. Os nomes óbvios — "planos", "grade",
   "banco", "janela" — já estão todos tomados, e um const repetido no
   escopo global não avisa nada: derruba a página inteira, vitrine
   junto. O invólucro é a cerca.
   ===================================================================== */

(function () {

const painel = document.getElementById('donoPlanos');
if (!painel) return;

const recado = document.getElementById('donoRecado');

const cfg = window.CONFIG_SUPABASE || {};
const bancoDono = (cfg.url && !cfg.url.startsWith('COLE_AQUI') && window.supabase)
    ? window.supabase.createClient(cfg.url, cfg.chavePublica)
    : null;


/* ---------------------------------------------------------------------
   O QUE CADA PLANO ENTREGA

   Texto comercial, e por isso no código: reajustar preço é mexer no
   banco, reescrever uma frase de venda não deveria ser.

   Três itens por cartão, e não os seis da planos.html. Quatro colunas
   com seis linhas cada viram uma parede que ninguém compara — e quem
   quiser comparar recurso por recurso tem o link no pé da seção.
   --------------------------------------------------------------------- */
const ENTREGA = {
    gratuito: {
        objetivo: 'Sua vaga no ar',
        periodo: 'sempre grátis',
        itens: [
            'Aparece nas buscas e em todos os filtros',
            'Contato direto no seu WhatsApp',
            'Quantas pessoas viram e chamaram',
        ],
    },
    destaque: {
        objetivo: 'Mais visibilidade',
        itens: [
            'Tudo do plano Grátis',
            'Selo e moldura que separam sua vaga',
            'Passa à frente de anúncios equivalentes',
        ],
    },
    premium: {
        objetivo: 'Mais exposição e mais dados',
        etiqueta: 'Mais escolhido',
        itens: [
            'Tudo do Destaque, com evidência maior',
            'Prioridade acima do plano Destaque',
            'De onde vieram as visitas do seu anúncio',
        ],
    },
    pro: {
        objetivo: 'Máxima exposição',
        itens: [
            'Prioridade máxima entre os compatíveis',
            'Relatório do período e atendimento prioritário',
            'Até 2 divulgações nas nossas redes',
        ],
    },
};


/* ---------------------------------------------------------------------
   Carregar e desenhar
   --------------------------------------------------------------------- */
async function iniciar() {
    if (!bancoDono) return falhar();

    const { data, error } = await bancoDono
        .from('planos')
        .select('slug, nome, preco_centavos, dias, selo, chamada, ordem, ativo')
        .eq('ativo', true)
        .order('ordem');

    if (error || !data || !data.length) {
        console.error('Falhou ao carregar os planos:', error);
        return falhar();
    }

    painel.replaceChildren(...data.map(cartao));
}

/* Sem os preços, quatro cartões vazios seriam pior que nenhum: a seção
   promete responder quanto custa e não responderia. Fica o convite de
   sempre, que funciona sozinho, e o caminho para a página dos planos. */
function falhar() {
    const aviso = document.createElement('p');
    aviso.className = 'dono-esperando';
    aviso.textContent = 'Não consegui carregar os planos agora.';

    const cadastrar = document.createElement('a');
    cadastrar.className = 'btn btn-branco';
    cadastrar.href = 'cadastrar-vaga.html';
    cadastrar.textContent = 'Cadastrar minha vaga de graça';

    painel.replaceChildren(aviso, cadastrar);
    painel.classList.add('dono-planos-falhou');
}


function cartao(plano) {
    const entrega = ENTREGA[plano.slug] || { itens: [] };
    const gratis = plano.preco_centavos === 0;

    const caixa = document.createElement('article');
    caixa.className = 'dplano dplano-' + plano.slug;
    if (entrega.etiqueta) caixa.classList.add('dplano-realce');

    if (entrega.etiqueta) {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'dplano-etiqueta';
        etiqueta.textContent = entrega.etiqueta;
        caixa.appendChild(etiqueta);
    }

    const nome = document.createElement('h3');
    nome.className = 'dplano-nome';
    nome.textContent = plano.selo ? plano.selo + ' ' + plano.nome : plano.nome;

    const objetivo = document.createElement('p');
    objetivo.className = 'dplano-objetivo';
    objetivo.textContent = entrega.objetivo || plano.chamada || '';

    /* O preço e o período, e a regra que não se quebra aqui: nunca
       "/mês". Não existe segunda cobrança, e essa é a mentira que a
       pessoa só descobre no extrato — quando já não acredita em mais
       nada do site. */
    const preco = document.createElement('div');
    preco.className = 'dplano-preco';
    preco.textContent = gratis ? 'R$ 0' : emReais(plano.preco_centavos);

    const periodo = document.createElement('p');
    periodo.className = 'dplano-periodo';
    periodo.textContent = gratis
        ? (entrega.periodo || 'sempre grátis')
        : 'pagamento único · até ' + plano.dias + ' dias';

    const itens = document.createElement('ul');
    itens.className = 'dplano-itens';
    itens.append(...entrega.itens.map(texto => {
        const li = document.createElement('li');
        li.textContent = texto;
        return li;
    }));

    caixa.append(nome, objetivo, preco, periodo, itens, botao(plano));
    return caixa;
}


/* ---------------------------------------------------------------------
   O botão

   O grátis é um link de verdade: leva ao cadastro e funciona sem
   JavaScript, com o botão do meio do mouse, em aba nova. Os pagos são
   botões porque o que vem depois deles depende de quem está clicando —
   quem já tem vaga publicada, quem tem conta mas nenhuma vaga, e quem
   nunca entrou seguem por caminhos diferentes.
   --------------------------------------------------------------------- */
function botao(plano) {
    if (plano.preco_centavos === 0) {
        const link = document.createElement('a');
        link.className = 'btn btn-branco dplano-botao';
        link.href = 'cadastrar-vaga.html';
        link.textContent = 'Anunciar';
        return link;
    }

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-branco dplano-botao';
    b.textContent = 'Anunciar';
    b.addEventListener('click', () => escolher(plano, b));
    return b;
}


/* ---------------------------------------------------------------------
   Escolheu um plano pago

   O destaque se contrata PARA UMA VAGA: a promoção no banco é amarrada
   a republica_id, e a cobrança confere que a vaga é de quem está
   pedindo e que ela já está publicada. Quem clica aqui na home, na
   maioria, ainda não tem vaga nenhuma — então o caminho passa pelo
   cadastro, levando o plano escolhido junto.

   Quem já tem conta e vaga publicada não repete nada disso: vai direto
   para o pagamento daquela vaga.
   --------------------------------------------------------------------- */
async function escolher(plano, botaoClicado) {
    botaoClicado.disabled = true;
    const antes = botaoClicado.textContent;
    botaoClicado.textContent = 'Um instante...';

    const destino = await caminhoDoPlano(plano.slug);

    botaoClicado.disabled = false;
    botaoClicado.textContent = antes;
    location.href = destino;
}

async function caminhoDoPlano(slug) {
    const cadastro = 'cadastrar-vaga.html?plano=' + encodeURIComponent(slug);
    if (!bancoDono) return cadastro;

    const { data: sessao } = await bancoDono.auth.getSession();
    if (!sessao || !sessao.session) return cadastro;

    /* Só vaga no ar e publicada pode ser destacada — é a mesma regra da
       função de cobrança, repetida aqui só para escolher o destino. Se
       divergir, o pior que acontece é a pessoa chegar na tela de
       pagamento e ouvir um não; quem manda continua sendo o servidor. */
    const { data: minhas } = await bancoDono
        .from('republicas')
        .select('id, ativa, status')
        .eq('dono_id', sessao.session.user.id);

    const elegiveis = (minhas || []).filter(v => v.ativa && v.status === 'publicada');
    if (!elegiveis.length) return cadastro;

    const alvo = 'planos.html?plano=' + encodeURIComponent(slug);
    return elegiveis.length === 1
        ? alvo + '&vaga=' + encodeURIComponent(elegiveis[0].id)
        : alvo;
}


iniciar();

})();
