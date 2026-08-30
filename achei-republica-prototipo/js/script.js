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

function montarFaculdades() {
    // Todas as faculdades da cidade, e não só as dos cartões visíveis:
    // se a ficha anterior tivesse filtrado, faculdade sumiria da lista
    // sem motivo nenhum.
    const daCidade = [...document.querySelectorAll('.anuncio')]
        .filter(c => c.dataset.cidade === selCidade.value);
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

function aplicarFicha() {
    const vitrineEl = document.getElementById('vitrine');
    const daCidade = [...vitrineEl.querySelectorAll('.anuncio')]
        .filter(c => c.dataset.cidade === selCidade.value);

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

    daCidade.forEach(c => { c.hidden = !lista.includes(c); });
    lista.forEach(c => vitrineEl.appendChild(c));

    // Filtro que não sobra nada é o mesmo caso de cidade sem anúncio.
    const vazia = lista.length === 0;
    document.getElementById('vitrine').hidden = vazia;
    vitrineVazia.hidden = !vazia;
    if (vazia) {
        vitrineVazia.querySelector('h3').innerHTML =
            'Nenhuma república com esse filtro';
        vitrineVazia.querySelector('p').textContent =
            'Tente outra ficha acima, ou veja todas as repúblicas da cidade.';
    }

    atualizarContagem(lista.length);
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
const chapeuDobra = document.querySelector('.heroi .chapeu');

function trocarCidade() {
    const slug = selCidade.value;
    const nome = selCidade.options[selCidade.selectedIndex].textContent.trim();

    const cartoes = [...document.querySelectorAll('.anuncio')];
    const daCidade = cartoes.filter(c => c.dataset.cidade === slug);

    cartoes.forEach(c => { c.hidden = c.dataset.cidade !== slug; });

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

    vitrineVazia.querySelector('h3').innerHTML =
        'Ainda não tem república em <span id="nomeCidadeVazia">' + nome + '</span>';
    vitrineVazia.querySelector('p').textContent =
        'Esta cidade entra no ar assim que receber o primeiro anúncio. Se você tem vaga aí, cadastre agora — quem chega primeiro fica no topo quando a cidade abrir.';

    if (!escolheu) {
        barraConta.classList.add('vazia');
        barraConta.innerHTML = `<span class="bolinha"></span>14 cidades do Sul de Minas`;
        chapeuDobra.innerHTML = `<span class="pisca"></span>Sul de Minas · Alfenas no ar`;
    } else if (temAnuncio) {
        atualizarContagem(daCidade.length);
        chapeuDobra.innerHTML = `<span class="pisca"></span>${nome}, MG · no ar`;
    } else {
        barraConta.classList.add('vazia');
        barraConta.innerHTML = `<span class="bolinha"></span>Nenhuma república cadastrada ainda`;
        chapeuDobra.innerHTML = `<span class="pisca"></span>${nome}, MG · em breve`;
    }
}

function atualizarContagem(quantas) {
    barraConta.classList.toggle('vazia', quantas === 0);
    barraConta.innerHTML = quantas === 0
        ? `<span class="bolinha"></span>Nenhuma república com esse filtro`
        : `<span class="bolinha"></span><b>${quantas}</b>&nbsp;${quantas === 1 ? 'república' : 'repúblicas'} com vaga aberta`;
}

selCidade.addEventListener('change', () => {
    trocarCidade();
    // Desce até a vitrine: quem troca a cidade quer ver o que tem lá, e
    // deixá-lo parado no seletor obriga a rolar na mão para descobrir.
    document.getElementById('republicas').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

ordemOriginal = [...document.querySelectorAll('.anuncio')];

// Na carga a página só se ajusta, sem rolar — senão o visitante cairia
// no meio do site antes de ler a primeira linha.
trocarCidade();

/* ---------------------------------------------------------------------
   Questionário e cálculo de compatibilidade
   --------------------------------------------------------------------- */
const PERGUNTAS = [
    {
        chave: 'uni',
        titulo: 'Onde você estuda?',
        dica: 'É daqui que a gente mede o trajeto até cada república.',
        opcoes: [
            { valor: 'UNIFAL', rotulo: 'UNIFAL' },
            { valor: 'UNIFENAS', rotulo: 'UNIFENAS' },
            { valor: 'IFSULDEMINAS', rotulo: 'IFSULDEMINAS' },
        ],
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

function desenharPasso() {
    const p = PERGUNTAS[passo];

    quizConta.textContent = `Pergunta ${passo + 1} de ${PERGUNTAS.length}`;
    quizPergunta.textContent = p.titulo;
    quizDica.textContent = p.dica;
    quizBarra.style.width = ((passo + 1) / PERGUNTAS.length * 100) + '%';
    quizVoltar.hidden = passo === 0;
    quizSeguir.textContent = passo === PERGUNTAS.length - 1 ? 'Ver minhas repúblicas' : 'Continuar';

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
    const p = PERGUNTAS[passo];
    quizSeguir.disabled = p.multi ? false : resposta[p.chave] === undefined;
}

function abrirQuiz() {
    focoAnterior = document.activeElement;
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
    if (passo < PERGUNTAS.length - 1) {
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
    const cartoes = [...vitrine.querySelectorAll('.anuncio')].filter(c => !c.hidden);
    if (!cartoes.length) return;

    const pontuados = cartoes.map(cartao => ({ cartao, ...pontuar(cartao) }));
    pontuados.sort((a, b) => b.pontos - a.pontos);

    pontuados.forEach(({ cartao, pontos }) => {
        cartao.querySelector('.selo-match').textContent = pontos + '%';
        vitrine.appendChild(cartao); // reordena mantendo o mesmo nó
    });

    // O cartão da primeira dobra passa a mostrar o melhor resultado real.
    const melhor = pontuados[0];
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

// A setinha aparece quando a primeira dobra sai de vista.
//
// Quem é observado é a dobra, e não o cabeçalho: o cabeçalho fica grudado
// no alto e nunca sai de vista, então a conta nunca fecharia e a setinha
// ficaria acesa até no topo da página.
const subir = document.querySelector('.subir');
const dobra = document.querySelector('.heroi');

new IntersectionObserver(([entrada]) => {
    subir.classList.toggle('aparece', !entrada.isIntersecting);
}, { rootMargin: '-200px 0px 0px 0px' }).observe(dobra);
