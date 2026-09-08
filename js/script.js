/* =====================================================================
   Achei República — comportamento da página.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Menu
   --------------------------------------------------------------------- */
const menuBotao = document.querySelector('.menu-botao');
const menu = document.getElementById('menu');

function fecharMenu() {
    menu.classList.remove('aberto');
    menuBotao.classList.remove('aberto');
    menuBotao.setAttribute('aria-expanded', 'false');
    menuBotao.setAttribute('aria-label', 'Abrir menu');
}

menuBotao.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');
    menuBotao.classList.toggle('aberto', aberto);
    menuBotao.setAttribute('aria-expanded', String(aberto));
    menuBotao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
});

menu.querySelectorAll('a').forEach(link => link.addEventListener('click', fecharMenu));
document.addEventListener('click', e => {
    if (!menu.contains(e.target) && !menuBotao.contains(e.target)) fecharMenu();
});

/* ---------------------------------------------------------------------
   Fichas de ordenação e painel de filtros
   --------------------------------------------------------------------- */
/* As fichas ordenam e filtram de verdade.
 *
 * Antes elas só acendiam e apagavam: "Menor preço" não ordenava nada e
 * "Aceita pet" não filtrava. Ficha que promete e não entrega é pior do
 * que ficha nenhuma, porque a pessoa acredita que a lista mudou.
 *
 * "Perto da faculdade" é o caso que o Igor apontou: sozinho não quer
 * dizer nada — perto de qual? Por isso ele abre um seletor com as
 * faculdades daquela cidade. */
const fichas = document.querySelectorAll('.ficha');
const fichaFaculdade = document.getElementById('fichaFaculdade');
const selFaculdade = document.getElementById('selFaculdade');

let fichaAtiva = 'combinam';
// A ordem de partida da vitrine. Vira a ordem do questionário depois
// que ele roda, para "Mais combinam" ter ao que voltar.
let ordemOriginal = [];

/* Quais cartões valem para uma cidade.

   As casas de verdade; e os seis exemplos só quando não há nenhuma.

   Isto é uma função, e não três filtros espalhados, porque quando só
   o trocarCidade sabia da regra, clicar em "Aceita pet" trazia os
   exemplos de volta para o meio das casas reais — a ficha refazia a
   conta por conta própria e não conhecia exemplo nenhum.

   Os exemplos vestem a cidade escolhida: assim o resto do arquivo
   continua comparando data-cidade sem precisar saber que existe
   exemplo. */
function cartoesDaCidade(slug) {
    const todos = [...document.querySelectorAll('.anuncio')];
    const reais = todos.filter(c => !c.dataset.exemplo && c.dataset.cidade === slug);
    const exemplos = todos.filter(c => c.dataset.exemplo);

    exemplos.forEach(c => { c.dataset.cidade = slug; });

    return { todos, daCidade: reais.length ? reais : exemplos, temReal: reais.length > 0 };
}

function montarFaculdades() {
    // Todas as faculdades da cidade, e não só as dos cartões visíveis:
    // se a ficha anterior tivesse filtrado, faculdade sumiria da lista
    // sem motivo nenhum.
    const daCidade = cartoesDaCidade(selCidade.value).daCidade;
    const siglas = [...new Set(daCidade.map(c => c.dataset.uni))].sort();

    const escolhida = selFaculdade.value;
    selFaculdade.innerHTML = '';
    siglas.forEach(sigla => {
        const o = document.createElement('option');
        o.value = sigla;
        o.textContent = sigla;
        selFaculdade.appendChild(o);
    });
    // Qual vem escolhida de largada, em ordem de preferência:
    // a que a pessoa já estava vendo, a que ela respondeu no
    // questionário, ou a que tem mais repúblicas. Ordem alfabética não
    // diz nada — deixaria o IFSULDEMINAS, com uma casa só, na frente da
    // UNIFAL, com quatro.
    const maisCasas = siglas.slice().sort((a, b) =>
        daCidade.filter(c => c.dataset.uni === b).length -
        daCidade.filter(c => c.dataset.uni === a).length)[0];

    selFaculdade.value =
        siglas.includes(escolhida) ? escolhida :
        siglas.includes(resposta.uni) ? resposta.uni :
        maisCasas;

    return siglas.length;
}

/* ---------------------------------------------------------------------
   O DESTAQUE PAGO, E O LIMITE DELE

   Esta é a parte do arquivo que decide se o estudante pode confiar na
   lista. Vale escrever a regra inteira, porque ela é fácil de afrouxar
   sem querer no dia em que alguém pedir "mais visibilidade".

   O destaque NUNCA escolhe QUEM aparece. Isso já foi decidido duas
   etapas antes: a ficha corta, o painel de filtros corta, e o que
   sobrou é a lista dos elegíveis. Uma casa que não aceita pet não
   entra na busca de quem marcou "aceita pet" nem pagando Premium.

   O destaque escolhe, dentro dos elegíveis, QUEM VEM ANTES — e mesmo
   isso com trava:

   A TRAVA DA FAIXA. Depois do questionário cada cartão tem uma nota de
   0 a 100. Comparar só o peso do plano deixaria um Premium de 40% na
   frente de um grátis de 95%, e a lista viraria propaganda. Então a
   comparação é por FAIXA de dez pontos: o destaque só desempata entre
   casas que combinam praticamente igual. Um Premium de 71 passa na frente
   de um grátis de 79 (mesma faixa dos 70). Um Premium de 51 não passa —
   fica onde a nota dele manda.

   Dez pontos é a distância em que a diferença de compatibilidade deixa
   de ser sentida por quem lê. Abaixo disso, qualquer uma das duas
   serve, e aí a preferência de quem pagou é justa.

   ONDE ESTA FUNÇÃO NÃO É CHAMADA, e é o ponto mais importante:

   "Menor preço" e "Mais perto da faculdade" são PROMESSAS LITERAIS. A
   pessoa pediu uma ordem específica e vai conferir com os olhos. Um
   anúncio pago furando a ordem de preço não seria exposição: seria a
   descoberta, em três segundos, de que a lista mente. Nessas duas
   fichas o pago ganha só a moldura — a posição é do preço e do
   trajeto.
   --------------------------------------------------------------------- */
function faixaDeCompatibilidade(cartao) {
    const pontos = Number(cartao.dataset.pontos);
    // Sem questionário respondido não há nota, e todo mundo empata na
    // mesma faixa — que é justamente quando o destaque deve valer mais.
    return Number.isFinite(pontos) ? Math.floor(pontos / 10) : 0;
}

function ordenarComDestaque(lista) {
    // A ordem de chegada vira o critério de desempate final: sem ela, o
    // sort embaralharia casas iguais a cada clique, e a lista dançaria
    // na frente da pessoa sem motivo.
    const posicao = new Map(lista.map((cartao, i) => [cartao, i]));

    return [...lista].sort((a, b) => {
        const faixaA = faixaDeCompatibilidade(a);
        const faixaB = faixaDeCompatibilidade(b);
        if (faixaA !== faixaB) return faixaB - faixaA;

        const pesoA = Number(a.dataset.peso || 0);
        const pesoB = Number(b.dataset.peso || 0);
        if (pesoA !== pesoB) return pesoB - pesoA;

        return posicao.get(a) - posicao.get(b);
    });
}

/* De onde veio quem está vendo esta lista. É o que responde, no painel
   do anunciante, "quantos estudantes chegaram até mim pelos filtros" —
   a pergunta que separa exposição de curiosidade. */
function origemDaLista() {
    if (document.querySelectorAll('#painelFiltros input:checked').length) return 'filtro';
    if (respondeu) return 'match';
    return 'vitrine';
}

/* ---------------------------------------------------------------------
   O ACABAMENTO DA LISTA

   Três coisas que precisam acontecer toda vez que a vitrine muda, venha
   a mudança de onde vier: a ordem com destaque, a contagem de que
   aquelas vagas apareceram, e a origem carimbada no link de cada
   cartão.

   Existe como função própria porque a vitrine muda por TRÊS caminhos
   diferentes — trocar de cidade, clicar numa ficha e responder o
   questionário — e só um deles passava pelo aplicarFicha(). Escrito lá
   dentro, abrir a home direto numa cidade não contava aparição nenhuma
   e mandava todo mundo para a página da vaga como "direto".

   reordenar = false nas fichas que prometem uma ordem literal (menor
   preço, mais perto): ali o pago ganha só a moldura.
   --------------------------------------------------------------------- */
function arrumarVitrine(lista, reordenar) {
    const vitrineEl = document.getElementById('vitrine');
    const ordenada = reordenar ? ordenarComDestaque(lista) : lista;

    ordenada.forEach(c => vitrineEl.appendChild(c));

    const origem = origemDaLista();
    const reais = ordenada.filter(c => !c.dataset.exemplo);

    if (typeof window.registrarMetricas === 'function') {
        window.registrarMetricas(reais.map(c => c.dataset.id), 'vitrine', origem);
    }

    /* A origem viaja no link para a página da vaga. Sem ela, toda visita
       seria contada como "direto", e o anunciante nunca saberia quantos
       chegaram pelos filtros — que é a pergunta que ele faz quando
       decide se vale destacar de novo.

       Reescrito inteiro a cada passagem, e não acrescentado: assim
       trocar de ficha não empilha "&de=" atrás de "&de=". */
    reais.forEach(c => {
        const ver = c.querySelector('.ver');
        if (ver) ver.href = `vaga.html?id=${c.dataset.id}&de=${origem}`;
    });

    return ordenada;
}

function aplicarFicha() {
    const daCidade = cartoesDaCidade(selCidade.value).daCidade;

    // Toda ficha parte da lista inteira da cidade: nada de filtro que se
    // acumula sem a pessoa perceber.
    daCidade.forEach(c => { c.hidden = false; });

    // Toda ficha parte da mesma base: a ordem de referência da cidade.
    // Sem isto, filtrar depois de ordenar herdava a ordenação anterior —
    // "Aceita pet" saía em ordem de preço, sem a pessoa ter pedido.
    const base = ordemOriginal.filter(c => daCidade.includes(c));
    let lista = base;

    if (fichaAtiva === 'faculdade') {
        const alvo = selFaculdade.value;
        lista = base.filter(c => c.dataset.uni === alvo)
                    .sort((a, b) => Number(a.dataset.min) - Number(b.dataset.min));
    } else if (fichaAtiva === 'preco') {
        lista = [...base].sort((a, b) => Number(a.dataset.preco) - Number(b.dataset.preco));
    } else if (fichaAtiva === 'pet') {
        lista = base.filter(c => (c.dataset.perfil || '').split(',').includes('pet'));
    } else if (fichaAtiva === 'caucao') {
        lista = base.filter(c => Number(c.dataset.caucao) === 0);
    }

    /* O painel de "Filtros completos" entra por cima da ficha, e não no
       lugar dela. As duas coisas são perguntas diferentes: a ficha diz
       como ORDENAR ou um corte rápido, o painel diz o que a casa
       precisa ter. Quem marcou "aceita pet" no painel e clicou em
       "menor preço" quer as duas coisas, e não a segunda apagando a
       primeira. */
    if (typeof window.passaNoPainel === 'function') {
        lista = lista.filter(window.passaNoPainel);
    }

    const corte = guardarGratisParaOFiltro(lista);
    lista = corte.lista;

    daCidade.forEach(c => { c.hidden = !lista.includes(c); });

    /* O destaque entra por ÚLTIMO, sobre o que sobrou dos cortes — e
       fora das duas fichas que prometem uma ordem literal. A leitura de
       cima para baixo deste trecho é a regra inteira: corta, corta, e
       só então o pago sobe entre iguais. */
    lista = arrumarVitrine(lista, fichaAtiva !== 'preco' && fichaAtiva !== 'faculdade');

    // Filtro que não sobra nada é o mesmo caso de cidade sem anúncio.
    const vazia = lista.length === 0;
    document.getElementById('vitrine').hidden = vazia;
    vitrineVazia.hidden = !vazia;
    if (vazia) {
        vitrineVazia.querySelector('h3').innerHTML =
            'Nenhuma república com esse filtro';
        vitrineVazia.querySelector('p').textContent =
            'Tente outra ficha acima, ou veja todas as repúblicas da cidade.';
        // Lista vazia por causa de um filtro não é cidade sem casa: o
        // convite para cadastrar a primeira não cabe aqui.
        document.getElementById('vazioCadastrar').hidden = true;
    }

    atualizarContagem(lista.length, corte.guardadas);
}


/* ---------------------------------------------------------------------
   A VITRINE CRUA É DOS PAGOS

   Na tela que a pessoa vê ao escolher a cidade — sem ficha, sem filtro,
   sem questionário — aparecem só os anúncios pagos. Os gratuitos ficam
   guardados para quem disser o que procura.

   A REGRA SE LIGA SOZINHA, e isso é o essencial. Ela só vale numa
   cidade que JÁ tem pelo menos um anúncio pago. Onde não há nenhum,
   nada é escondido — senão Alfenas, que hoje tem um anúncio e ele é
   gratuito, abriria vazia para todo estudante que chegasse, e um site
   vazio não atrai a república que a gente quer que pague.

   POR QUE SÓ NA VITRINE CRUA, e nunca depois de um clique:

   Clicar numa ficha ou marcar um filtro é a pessoa dizendo o que quer,
   e a lista passa a ser uma resposta ao que ela pediu. Esconder casa
   dentro de uma resposta é a lista mentindo — e em "Menor preço" seria
   escancarado: a lista ordenada por preço sem as mais baratas se
   desmonta em três segundos na cabeça de quem lê.

   E o número escondido é DITO, na contagem. Guardar sem avisar seria
   sonegar oferta de quem procura; avisando, vira o empurrão para as
   cinco perguntas — que é onde este site é bom.
   --------------------------------------------------------------------- */
function vitrineCrua() {
    if (fichaAtiva !== 'combinam') return false;
    if (respondeu) return false;
    if (typeof window.painelTemFiltro === 'function' && window.painelTemFiltro()) return false;
    return true;
}

function guardarGratisParaOFiltro(lista) {
    if (!vitrineCrua()) return { lista, guardadas: 0 };

    const pagos = lista.filter(c => Number(c.dataset.peso || 0) > 0);

    // Cidade sem nenhum pago mostra tudo. Também é por aqui que os seis
    // cartões de exemplo continuam aparecendo: eles não têm peso, e onde
    // eles estão não há pago nenhum.
    if (!pagos.length) return { lista, guardadas: 0 };

    return { lista: pagos, guardadas: lista.length - pagos.length };
}

fichas.forEach(ficha => {
    ficha.addEventListener('click', () => {
        fichas.forEach(f => f.classList.remove('ativa'));
        ficha.classList.add('ativa');
        fichaAtiva = ficha.dataset.ficha;

        const ehFaculdade = fichaAtiva === 'faculdade';
        fichaFaculdade.hidden = !ehFaculdade || montarFaculdades() === 0;

        aplicarFicha();
    });
});

selFaculdade.addEventListener('change', aplicarFicha);

const abrirFiltros = document.getElementById('abrirFiltros');
const painelFiltros = document.getElementById('painelFiltros');

abrirFiltros.addEventListener('click', () => {
    const aberto = painelFiltros.classList.toggle('aberto');
    abrirFiltros.classList.toggle('aberto', aberto);
    abrirFiltros.setAttribute('aria-expanded', String(aberto));
    abrirFiltros.firstChild.textContent = aberto ? 'Fechar filtros ' : 'Filtros completos ';
});

document.getElementById('limparFiltros').addEventListener('click', () => {
    painelFiltros.querySelectorAll('input[type="checkbox"]').forEach(c => (c.checked = false));
    painelFiltros.querySelectorAll('input[type="number"], input[type="date"]').forEach(i => (i.value = ''));
    painelFiltros.querySelectorAll('select').forEach(s => (s.selectedIndex = 0));
});

/* ---------------------------------------------------------------------
   Cidade escolhida

   Manda em tudo que vem abaixo: o título da vitrine, quais anúncios
   aparecem, a contagem e o selo da primeira dobra. Hoje só Alfenas tem
   anúncio; as outras caem no estado vazio, que é onde o pedido de
   cadastro faz mais sentido — a falta de oferta está na cara de quem
   está olhando naquele instante.
   --------------------------------------------------------------------- */
const selCidade = document.getElementById('selCidade');
const nomeCidade = document.getElementById('nomeCidade');
const nomeCidadeVazia = document.getElementById('nomeCidadeVazia');
const barraConta = document.getElementById('barraConta');
const vitrineVazia = document.getElementById('vitrineVazia');
const avisoExemplo = document.getElementById('avisoExemplo');
const chapeuDobra = document.querySelector('.heroi .chapeu');

/* Se o questionário já foi respondido. Separa o que a página pode
   afirmar do que ela ainda não sabe: antes disso não há perfil, e tudo
   que fala em compatibilidade é exemplo. */
let respondeu = false;

function trocarCidade() {
    const slug = selCidade.value;
    const nome = selCidade.options[selCidade.selectedIndex].textContent.trim();

    const cartoes = [...document.querySelectorAll('.anuncio')];

    /* República de verdade na frente do exemplo.

       Os seis cartões escritos à mão no HTML continuam existindo, mas
       só aparecem em cidade que ainda não tem nenhuma casa cadastrada.
       A cidade que tem mostra as de verdade, e os exemplos somem —
       anúncio que não dá para clicar no meio de anúncio que dá é o
       mesmo problema do botão que falha no clique.

       Os exemplos não são de cidade nenhuma: eles vestem a cidade
       escolhida, para as fichas e o questionário continuarem filtrando
       por data-cidade sem precisar saber que exemplo existe. */
    const { daCidade, temReal } = cartoesDaCidade(slug);

    cartoes.forEach(c => { c.hidden = !daCidade.includes(c); });

    // A faixa que avisa, sem rodeio, que aquilo ali é exemplo — e
    // convida a pessoa a ser a primeira da cidade dela.
    const mostrandoExemplo = slug !== '' && !temReal;
    avisoExemplo.hidden = !mostrandoExemplo;
    if (mostrandoExemplo) {
        document.getElementById('nomeCidadeExemplo').textContent = nome;
        document.getElementById('cadastrarPrimeira').href =
            'cadastrar-vaga.html?cidade=' + slug;
    }

    // Três estados, e não dois: sem cidade escolhida, cidade com anúncio
    // e cidade sem anúncio. O primeiro existe porque a página não decide
    // por conta própria onde a pessoa quer morar.
    const escolheu = slug !== '';
    const temAnuncio = escolheu && daCidade.length > 0;

    nomeCidade.textContent = escolheu ? nome : 'Alfenas e região';
    nomeCidadeVazia.textContent = nome;

    // A seção inteira só existe depois da escolha. Um cartão pedindo
    // "escolha sua cidade" logo abaixo de um seletor que pede a mesma
    // coisa era repetição ocupando uma tela inteira.
    document.getElementById('republicas').hidden = !escolheu;

    /* O cartão de compatibilidade e a linha "ordenadas por quanto
       combinam" só valem depois do questionário.

       Antes dele os dois mentem: o cartão mostra 96% para uma
       república que ninguém escolheu, e a linha diz "com o perfil que
       você respondeu" sem ninguém ter respondido nada. Quem acabou de
       escolher a cidade quer ver o que tem lá — e encontrava, entre o
       nome da cidade e a lista, uma tela inteira de resultado
       inventado.

       Escondidos, a seção abre no que ela promete: o nome da cidade, os
       filtros e as vagas. O questionario traz os dois de volta, aí com
       o resultado de verdade. */
    document.getElementById('cartaoMatch').hidden = !respondeu;
    document.querySelector('#republicas .cabeca p').hidden = !respondeu;
    vitrineVazia.hidden = !escolheu || temAnuncio;
    document.getElementById('vitrine').hidden = !temAnuncio;

    // Sem anúncio não há o que ordenar nem filtrar: os controles somem
    // junto, senão viram botão que promete resultado e não entrega.
    document.querySelector('.fichas').hidden = !temAnuncio;
    document.getElementById('abrirFiltros').hidden = !temAnuncio;
    if (!temAnuncio) {
        painelFiltros.classList.remove('aberto');
        abrirFiltros.classList.remove('aberto');
        abrirFiltros.setAttribute('aria-expanded', 'false');
    }

    // Trocar de cidade volta as fichas ao começo. Manter "Aceita pet"
    // aceso de uma cidade para outra faria a pessoa achar que a nova
    // cidade tem menos república do que realmente tem.
    fichas.forEach(f => f.classList.toggle('ativa', f.dataset.ficha === 'combinam'));
    fichaAtiva = 'combinam';
    fichaFaculdade.hidden = true;

    // De volta à caixa de cidade sem casa, o convite vale outra vez.
    document.getElementById('vazioCadastrar').hidden = false;

    vitrineVazia.querySelector('h3').innerHTML =
        'Ainda não tem república em <span id="nomeCidadeVazia">' + nome + '</span>';
    vitrineVazia.querySelector('p').textContent =
        'Esta cidade entra no ar assim que receber o primeiro anúncio. Se você tem vaga aí, cadastre agora — quem chega primeiro fica no topo quando a cidade abrir.';

    if (!escolheu) {
        barraConta.classList.add('vazia');
        barraConta.innerHTML = `<span class="bolinha"></span>15 cidades universitárias de Minas Gerais`;
        chapeuDobra.innerHTML = `<span class="pisca"></span>Minas Gerais · Alfenas no ar`;
    } else if (temAnuncio) {
        atualizarContagem(daCidade.length);
        chapeuDobra.innerHTML = `<span class="pisca"></span>${nome}, MG · no ar`;

        /* A ordem, a contagem de aparições e a origem nos links.

           Aqui e não só no aplicarFicha() porque este é o caminho da
           ABERTURA da página: quem chega pelo link de uma cidade vê a
           vitrine montada por esta função e pode nunca clicar em ficha
           nenhuma. Sem esta linha, a visita mais comum do site era a
           única que não contava nada. */
        arrumarVitrine(daCidade, true);
    } else {
        barraConta.classList.add('vazia');
        barraConta.innerHTML = `<span class="bolinha"></span>Nenhuma república cadastrada ainda`;
        chapeuDobra.innerHTML = `<span class="pisca"></span>${nome}, MG · em breve`;
    }
}

function atualizarContagem(quantas, guardadas) {
    barraConta.classList.toggle('vazia', quantas === 0);
    barraConta.innerHTML = quantas === 0
        ? `<span class="bolinha"></span>Nenhuma república com esse filtro`
        : `<span class="bolinha"></span><b>${quantas}</b>&nbsp;${quantas === 1 ? 'república' : 'repúblicas'} com vaga aberta`;

    /* O que está guardado é dito. Uma lista curta sem explicação é lida
       como "a cidade tem pouca coisa" — e a pessoa fecha a aba em vez de
       responder as cinco perguntas, que é justamente o que faria as
       outras aparecerem. */
    if (guardadas > 0) {
        const mais = document.createElement('span');
        mais.className = 'conta-mais';
        mais.textContent = guardadas === 1
            ? '+1 aparece quando você filtra ou responde as 5 perguntas'
            : `+${guardadas} aparecem quando você filtra ou responde as 5 perguntas`;
        barraConta.appendChild(mais);
    }
}

/* ---------------------------------------------------------------------
   A porta dos classificados

   O seletor não filtra nada aqui: ele abre a página dos classificados
   já na cidade e no cômodo escolhidos. Levar as duas coisas na URL
   evita a tela do meio — "escolha a cidade" logo depois de ela ter
   escolhido a cidade.
   --------------------------------------------------------------------- */
const selPrecisando = document.getElementById('selPrecisando');
const linkDesfazendo = document.getElementById('linkDesfazendo');

function enderecoDosClassificados(parametros) {
    const query = new URLSearchParams(parametros);
    if (selCidade.value) query.set('cidade', selCidade.value);
    return 'classificados.html?' + query.toString();
}

selPrecisando.addEventListener('change', () => {
    if (!selPrecisando.value) return;
    window.location.href = enderecoDosClassificados({
        modo: 'precisando',
        comodo: selPrecisando.value
    });
});

/* Quem está se desfazendo não veio olhar vitrine: veio anunciar. Vai
   direto para a página de anunciar, e não para a lista com um "modo"
   pendurado na URL — a página de lá cuida sozinha de mandar ao login
   quem ainda não tem conta, e de trazer de volta depois.

   O endereço é refeito a cada troca de cidade em vez de ser montado no
   clique: como é um <a> de verdade, abrir em nova aba — que não
   dispara clique nenhum — continua indo para o lugar certo, com a
   cidade junto. */
function atualizarLinkDesfazendo() {
    linkDesfazendo.href = selCidade.value
        ? `anunciar.html?cidade=${selCidade.value}`
        : 'anunciar.html';
}
atualizarLinkDesfazendo();

selCidade.addEventListener('change', () => {
    trocarCidade();
    atualizarLinkDesfazendo();

    // O cômodo volta ao começo: ele é a porta de uma cidade, e deixá-lo
    // aceso na cidade nova diria que a escolha anterior ainda vale.
    selPrecisando.value = '';

    // Quem já respondeu leva o perfil junto para a cidade nova. Sem
    // isto o cartão continuaria mostrando a melhor república da cidade
    // anterior, com o nome e o preço de lá, embaixo do título da nova.
    if (respondeu) aplicarResultado();

    // Desce até a vitrine: quem troca a cidade quer ver o que tem lá, e
    // deixá-lo parado no seletor obriga a rolar na mão para descobrir.
    document.getElementById('republicas').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

ordemOriginal = [...document.querySelectorAll('.anuncio')];

/* O js/vitrine.js busca as repúblicas no banco e chama isto quando elas
   chegam. Precisa existir porque a busca é assíncrona: quando este
   arquivo roda, os únicos cartões na página são os seis de exemplo, e
   ordemOriginal nasceria sem nenhuma casa de verdade dentro. */
window.reconstruirVitrine = function () {
    ordemOriginal = [...document.querySelectorAll('.anuncio')];
    trocarCidade();
};

/* Quem volta dos classificados traz a cidade na URL. Sem ler isso, o
   "voltar para as repúblicas" devolveria a pessoa a uma página sem
   cidade escolhida, pedindo de novo o que ela já disse duas telas
   atrás. */
const cidadeNaURL = new URLSearchParams(location.search).get('cidade');
if (cidadeNaURL && [...selCidade.options].some(o => o.value === cidadeNaURL)) {
    selCidade.value = cidadeNaURL;
}

// Na carga a página só se ajusta, sem rolar — senão o visitante cairia
// no meio do site antes de ler a primeira linha. Quem veio com cidade
// na URL trouxe uma âncora junto, e o navegador rola por conta.
trocarCidade();
atualizarLinkDesfazendo();

/* ---------------------------------------------------------------------
   Questionário e cálculo de compatibilidade
   --------------------------------------------------------------------- */
const PERGUNTAS = [
    {
        chave: 'uni',
        titulo: 'Onde você estuda?',
        dica: 'É daqui que a gente mede o trajeto até cada república.',
        /* Vazio de propósito. As opções vêm da CIDADE escolhida, e são
           preenchidas em perguntasDaVez() toda vez que o questionário
           abre.

           Aqui estavam UNIFAL, UNIFENAS e IFSULDEMINAS escritas à mão.
           Funcionou enquanto Alfenas era o mundo inteiro; com Belo
           Horizonte na lista, perguntar a um estudante da UFMG se ele
           faz UNIFAL quebra o cálculo de trajeto, que é metade da nota
           de compatibilidade.

           E havia um erro mais antigo escondido nessa lista: o
           IFSULDEMINAS estava oferecido em Alfenas, mas não existe no
           banco como faculdade de Alfenas — quem o escolhesse não
           casaria com casa nenhuma. Vindo do banco, a pergunta e a
           resposta passam a ser a mesma lista. */
        opcoes: [],
    },
    {
        chave: 'curso',
        titulo: 'Qual seu curso?',
        dica: 'Morar com gente do mesmo curso ajuda mais do que parece — horário, prova, material.',
        opcoes: [
            { valor: 'Medicina', rotulo: 'Medicina' },
            { valor: 'Enfermagem', rotulo: 'Enfermagem' },
            { valor: 'Odontologia', rotulo: 'Odontologia' },
            { valor: 'Nutrição', rotulo: 'Nutrição' },
            { valor: 'Direito', rotulo: 'Direito' },
            { valor: 'Agronomia', rotulo: 'Agronomia' },
            { valor: 'Veterinária', rotulo: 'Veterinária' },
            { valor: 'Administração', rotulo: 'Administração' },
            { valor: 'Informática', rotulo: 'Informática' },
            { valor: 'Letras', rotulo: 'Letras' },
            { valor: 'outro', rotulo: 'Outro curso' },
        ],
        colunas: 2,
    },
    {
        chave: 'teto',
        titulo: 'Quanto dá para pagar por mês?',
        dica: 'Contando só o aluguel da vaga.',
        opcoes: [
            { valor: 600, rotulo: 'Até R$ 600' },
            { valor: 700, rotulo: 'Até R$ 700' },
            { valor: 800, rotulo: 'Até R$ 800' },
            { valor: 9999, rotulo: 'Acima disso, tanto faz' },
        ],
    },
    {
        chave: 'tempo',
        titulo: 'Quanto tempo topa até a faculdade?',
        dica: 'Todo dia, ida e volta. Pense no dia de chuva.',
        opcoes: [
            { valor: 5, rotulo: 'Até 5 minutos' },
            { valor: 10, rotulo: 'Até 10 minutos' },
            { valor: 15, rotulo: 'Até 15 minutos' },
            { valor: 99, rotulo: 'Distância não é problema' },
        ],
    },
    {
        chave: 'jeito',
        titulo: 'Como você quer morar?',
        dica: 'Pode marcar mais de uma. Ou nenhuma, se tanto faz.',
        multi: true,
        opcoes: [
            { valor: 'silencioso', rotulo: 'Ambiente silencioso' },
            { valor: 'festas', rotulo: 'Casa animada' },
            { valor: 'pet', rotulo: 'Tenho pet' },
            { valor: 'individual', rotulo: 'Quarto só meu' },
            { valor: 'mista', rotulo: 'República mista' },
            { valor: 'feminina', rotulo: 'Somente feminina' },
            { valor: 'masculina', rotulo: 'Somente masculina' },
        ],
        colunas: 2,
    },
];

const quiz = document.getElementById('quiz');
const quizConta = document.getElementById('quizConta');
const quizPergunta = document.getElementById('quizPergunta');
const quizDica = document.getElementById('quizDica');
const quizOpcoes = document.getElementById('quizOpcoes');
const quizBarra = document.getElementById('quizBarra');
const quizVoltar = document.getElementById('quizVoltar');
const quizSeguir = document.getElementById('quizSeguir');
const quizFechar = document.getElementById('quizFechar');

let passo = 0;
const resposta = {};
let focoAnterior = null;

/* As perguntas DESTA rodada. Não é a constante PERGUNTAS direto porque
   a lista muda com a cidade: as faculdades são as de lá, e a pergunta
   inteira some numa cidade que ainda não tem faculdade cadastrada.

   Preenchida no abrirQuiz(), e não uma vez no carregamento, porque a
   pessoa troca de cidade com o site já aberto. */
let perguntas = PERGUNTAS;

/* Monta a rodada para a cidade escolhida.

   A pergunta da faculdade só entra se houver faculdade. Uma pergunta com
   zero opções seria uma tela que não deixa continuar — e o botão
   "Continuar" nasce desabilitado esperando uma escolha impossível. */
function perguntasDaVez() {
    const daCidade = (window.FACULDADES_POR_CIDADE || {})[selCidade.value] || [];

    return PERGUNTAS.filter(p => p.chave !== 'uni' || daCidade.length)
        .map(p => p.chave !== 'uni' ? p : {
            ...p,
            /* Duas colunas quando a lista é longa: BH tem dezenove
               campi, e dezenove botões de largura inteira viram uma
               rolagem que ninguém lê até o fim. */
            colunas: daCidade.length > 6 ? 2 : 1,
            opcoes: daCidade.map(sigla => ({ valor: sigla, rotulo: sigla })),
        });
}

function desenharPasso() {
    const p = perguntas[passo];

    quizConta.textContent = `Pergunta ${passo + 1} de ${perguntas.length}`;
    quizPergunta.textContent = p.titulo;
    quizDica.textContent = p.dica;
    quizBarra.style.width = ((passo + 1) / perguntas.length * 100) + '%';
    quizVoltar.hidden = passo === 0;
    quizSeguir.textContent = passo === perguntas.length - 1 ? 'Ver minhas repúblicas' : 'Continuar';

    quizOpcoes.className = 'quiz-opcoes' + (p.colunas === 2 ? ' multi' : '');
    quizOpcoes.innerHTML = '';

    p.opcoes.forEach(opcao => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'opcao';
        botao.innerHTML = `<span class="marca" aria-hidden="true">✓</span><span>${opcao.rotulo}</span>`;

        const jaEscolhido = p.multi
            ? (resposta[p.chave] || []).includes(opcao.valor)
            : resposta[p.chave] === opcao.valor;
        botao.classList.toggle('escolhida', jaEscolhido);

        botao.addEventListener('click', () => {
            if (p.multi) {
                const atuais = resposta[p.chave] || [];
                resposta[p.chave] = atuais.includes(opcao.valor)
                    ? atuais.filter(v => v !== opcao.valor)
                    : atuais.concat(opcao.valor);
                botao.classList.toggle('escolhida');
            } else {
                resposta[p.chave] = opcao.valor;
                quizOpcoes.querySelectorAll('.opcao').forEach(b => b.classList.remove('escolhida'));
                botao.classList.add('escolhida');
            }
            conferirSeguir();
        });

        quizOpcoes.appendChild(botao);
    });

    conferirSeguir();
}

// A última pergunta aceita nenhuma resposta; as outras não seguem em branco.
function conferirSeguir() {
    const p = perguntas[passo];
    quizSeguir.disabled = p.multi ? false : resposta[p.chave] === undefined;
}

function abrirQuiz() {
    focoAnterior = document.activeElement;
    // A rodada se monta agora: a cidade pode ter mudado desde a última vez.
    perguntas = perguntasDaVez();
    passo = 0;
    quiz.hidden = false;
    document.body.style.overflow = 'hidden';
    desenharPasso();
    quizSeguir.focus();
}

function fecharQuiz() {
    quiz.hidden = true;
    document.body.style.overflow = '';
    if (focoAnterior) focoAnterior.focus();
}

quizSeguir.addEventListener('click', () => {
    if (passo < perguntas.length - 1) {
        passo++;
        desenharPasso();
        quiz.querySelector('.quiz-caixa').scrollTop = 0;
    } else {
        fecharQuiz();
        aplicarResultado();
    }
});

quizVoltar.addEventListener('click', () => {
    if (passo > 0) { passo--; desenharPasso(); }
});

quizFechar.addEventListener('click', fecharQuiz);
quiz.addEventListener('click', e => { if (e.target === quiz) fecharQuiz(); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !quiz.hidden) fecharQuiz();
});

// Delegação, e não um ouvinte por botão: o cartão do match deixa de
// abrir o questionário depois que ele é respondido, e para isso basta
// perder o atributo. Com ouvinte preso no elemento, removê-lo não
// desligaria nada e o botão faria as duas coisas.
document.addEventListener('click', e => {
    const botao = e.target.closest('[data-abre-quiz]');
    if (!botao) return;
    e.preventDefault();
    abrirQuiz();
});

/* ---------------------------------------------------------------------
   O cálculo

   Cinco critérios somando 100. Cada um que bate devolve também a frase
   que explica por que bateu — é a lista de motivos do cartão, e é o que
   separa isto de um número inventado.
   --------------------------------------------------------------------- */
function pontuar(cartao) {
    const dados = {
        uni: cartao.dataset.uni,
        cursos: (cartao.dataset.cursos || '').split(','),
        preco: Number(cartao.dataset.preco),
        minutos: Number(cartao.dataset.min),
        modo: cartao.dataset.modo === 'bike' ? 'de bike' : 'a pé',
        perfil: (cartao.dataset.perfil || '').split(','),
    };

    let pontos = 0;
    const motivos = [];

    // Faculdade — 25
    if (dados.uni === resposta.uni) {
        pontos += 25;
        motivos.push(`Fica do lado da ${dados.uni}`);
    }

    // Curso — 20
    if (resposta.curso && resposta.curso !== 'outro' && dados.cursos.includes(resposta.curso)) {
        pontos += 20;
        motivos.push(`Tem gente de ${resposta.curso} morando lá`);
    }

    // Orçamento — 25, com meia pontuação para quem passa pouco do teto
    if (dados.preco <= resposta.teto) {
        pontos += 25;
        motivos.push(`R$ ${dados.preco} — dentro do que você informou`);
    } else if (dados.preco <= resposta.teto + 100) {
        pontos += 12;
    }

    // Trajeto — 20
    if (dados.minutos <= resposta.tempo) {
        pontos += 20;
        motivos.push(`A ${dados.minutos} minutos ${dados.modo} da sua faculdade`);
    }

    // Jeito de morar — 10 divididos entre o que a pessoa marcou
    const querido = resposta.jeito || [];
    if (querido.length) {
        const batidas = querido.filter(j => dados.perfil.includes(j));
        pontos += Math.round((batidas.length / querido.length) * 10);
        batidas.forEach(j => {
            const frases = {
                silencioso: 'Ambiente silencioso, como você pediu',
                festas: 'Casa animada, como você pediu',
                pet: 'Aceita pet',
                individual: 'Tem quarto individual',
                mista: 'É república mista',
                feminina: 'É somente feminina',
                masculina: 'É somente masculina',
            };
            if (frases[j]) motivos.push(frases[j]);
        });
    } else {
        pontos += 10;
    }

    return { pontos: Math.min(pontos, 100), motivos };
}

const vitrine = document.getElementById('vitrine');
const aviso = document.getElementById('resultadoAviso');

function aplicarResultado() {
    // Só a cidade escolhida entra na conta: ordenar república de Lavras
    // junto com as de Alfenas não faria sentido nenhum para quem está
    // procurando em uma das duas.
    /* Guardar o que a pessoa procurou vem ANTES da saída por lista
       vazia, e é de propósito. A busca que não encontra nada é a mais
       valiosa das duas: é ela que diz em qual cidade vale a pena bater
       na porta das repúblicas. Registrar só quando dá resultado seria
       perguntar sobre a demanda só onde a oferta já existe. */
    if (typeof window.registrarBusca === 'function') {
        window.registrarBusca({ ...resposta, cidade: selCidade.value });
    }

    const cartoes = [...vitrine.querySelectorAll('.anuncio')].filter(c => !c.hidden);
    if (!cartoes.length) return;

    const pontuados = cartoes.map(cartao => ({ cartao, ...pontuar(cartao) }));
    pontuados.sort((a, b) => b.pontos - a.pontos);

    pontuados.forEach(({ cartao, pontos }) => {
        cartao.querySelector('.selo-match').textContent = pontos + '%';
        // A nota fica gravada no cartão porque a ordenação com destaque
        // precisa dela depois, em cada clique de ficha, sem refazer a
        // conta inteira.
        cartao.dataset.pontos = pontos;
    });

    /* O cartão da primeira dobra mostra a MAIOR NOTA, e não o primeiro
       da lista. A diferença aparece quando um anúncio pago sobe uma
       posição dentro da faixa dele: a lista embaixo respeita o
       destaque, mas o "seu melhor match", com a rosquinha de
       porcentagem, continua sendo o que de fato pontuou mais.

       Vender aquele lugar seria vender a única frase da página que o
       estudante tem motivo para acreditar. */
    const melhor = pontuados[0];

    // Agora sim a lista, com o desempate de quem pagou entre iguais.
    arrumarVitrine(pontuados.map(p => p.cartao), true);
    if (melhor) {
        const nome = melhor.cartao.querySelector('h3').textContent;
        const onde = melhor.cartao.querySelector('.anuncio-onde').textContent;
        const preco = melhor.cartao.dataset.preco;

        document.querySelector('.match-quem h3').textContent = nome;
        document.querySelector('.match-quem p').textContent = onde;
        document.querySelector('.match-preco').innerHTML = `R$ ${preco}<span> /mês</span>`;

        const nota = document.getElementById('notaMatch');
        nota.querySelector('b').textContent = melhor.pontos + '%';
        nota.setAttribute('aria-label', `${melhor.pontos} por cento de compatibilidade`);
        nota.style.setProperty('--fatia', (melhor.pontos * 3.6) + 'deg');

        // Deixa de ser exemplo: agora é o resultado da pessoa.
        document.getElementById('matchSelo').hidden = true;

        const lista = document.querySelector('.match-lista');
        lista.innerHTML = '';
        melhor.motivos.slice(0, 5).forEach(motivo => {
            const item = document.createElement('li');
            item.innerHTML = `<span class="ok">✓</span>${motivo}`;
            lista.appendChild(item);
        });
    }

    ordemOriginal = pontuados.map(p => p.cartao);

    // O botão do cartão deixa de abrir o questionário: quem já
    // respondeu não quer "achar minha república" de novo, quer ver a
    // que apareceu. Passa a levar até ela na lista.
    const botaoCartao = document.querySelector('.match-pe .btn');
    botaoCartao.textContent = 'Ver esta vaga';
    botaoCartao.removeAttribute('data-abre-quiz');
    botaoCartao.onclick = () => {
        const primeiro = vitrine.querySelector('.anuncio:not([hidden])');
        if (primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Esquece a faculdade que estava selecionada: a pessoa acabou de
    // dizer onde estuda, e essa resposta vale mais que a lembrança do
    // que ela estava olhando antes.
    selFaculdade.value = '';

    // A partir daqui a página tem um perfil para comparar, e o cartão
    // e a linha do cabeçalho deixam de ser promessa vazia.
    respondeu = true;
    document.getElementById('cartaoMatch').hidden = false;
    document.querySelector('#republicas .cabeca p').hidden = false;

    aviso.classList.add('aparece');
    document.getElementById('republicas').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('refazerQuiz').addEventListener('click', abrirQuiz);

/* ---------------------------------------------------------------------
   Rosca do match e setinha de voltar
   --------------------------------------------------------------------- */

// A rosca só se preenche quando o cartão entra na tela: animar antes
// desperdiça o único momento em que o número chama atenção.
const nota = document.getElementById('notaMatch');
if (nota) {
    new IntersectionObserver((entradas, observador) => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;
            const porcento = parseInt(nota.querySelector('b').textContent, 10) || 0;
            nota.style.setProperty('--fatia', (porcento * 3.6) + 'deg');
            observador.disconnect();
        });
    }, { threshold: 0.4 }).observe(nota);
}

/* A setinha aparece depois da primeira dobra.

   Era um IntersectionObserver olhando a dobra. Funcionava no computador
   e não no celular — e observador com rootMargin negativo é justamente
   o canto onde os navegadores de celular mais divergem. Trocado por uma
   conta de rolagem: menos elegante, e funciona igual em todo navegador
   que existe.

   O clique é tratado abaixo, junto com os outros links que prometem o
   topo. */
const subir = document.querySelector('.subir');
const dobra = document.querySelector('.heroi');

if (subir) {
    const conferirSetinha = () => {
        const alvo = dobra ? dobra.offsetHeight * 0.6 : 400;
        subir.classList.toggle('aparece', window.scrollY > alvo);
    };

    window.addEventListener('scroll', conferirSetinha, { passive: true });
    window.addEventListener('resize', conferirSetinha);
    conferirSetinha();
}


/* ---------------------------------------------------------------------
   Tudo que promete o topo

   São quatro: a logo, o "Busque repúblicas" do menu, o mesmo link no
   rodapé e a setinha. O href="#topo" sozinho não leva ninguém a lugar
   nenhum, e a razão é sutil: o id mora no cabeçalho, que é
   position:sticky e portanto está SEMPRE colado no alto da tela.
   "Role até ele" resolve para "role até onde você já está".

   Medido antes do conserto: rolagem em 3000, clique no menu, rolagem
   continua em 3000. Nada se movia, e o menu parecia quebrado.

   A setinha já tinha esse remédio desde antes; faltava valer para os
   outros três. Rolar até zero na mão nunca falha.

   O href continua no HTML de propósito: sem JavaScript ele ao menos
   leva ao topo numa recarga, e o clique do meio ainda abre em aba nova.
   --------------------------------------------------------------------- */
document.addEventListener('click', evento => {
    const link = evento.target.closest('a[href="#topo"]');
    if (!link) return;

    evento.preventDefault();

    /* Quem pediu menos animação no sistema recebe o salto seco. O CSS
       já respeita isso no scroll-behavior; o scrollTo não respeita
       sozinho, e ficaria um caso escapando pelo meio. */
    const suave = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto' : 'smooth';

    window.scrollTo({ top: 0, behavior: suave });
});
