/* =====================================================================
   Achei República — classificados

   Quem sai da cidade tem geladeira, ventilador e escrivaninha que não
   cabem na mudança. Quem chega precisa exatamente disso e não quer
   comprar novo. Hoje os dois se encontram por acaso, num grupo de
   WhatsApp onde o anúncio some na rolagem em duas horas.

   A página recebe da home, pela URL, a cidade e o cômodo que a pessoa
   já escolheu lá. Repetir a pergunta aqui seria fazê-la escolher duas
   vezes a mesma coisa.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Ligação com o banco

   O mesmo desenho do conta.js: enquanto o projeto do Supabase não
   existe, o arquivo de configuração fica com o COLE_AQUI e a página
   funciona sem banco, mostrando o estado vazio de verdade em vez de
   quebrar numa tela branca.
   --------------------------------------------------------------------- */
const cfgClassificados = window.CONFIG_SUPABASE || {};
const bancoLigado = cfgClassificados.url && !cfgClassificados.url.startsWith('COLE_AQUI');

const bancoClassificados = (bancoLigado && window.supabase)
    ? window.supabase.createClient(cfgClassificados.url, cfgClassificados.chavePublica)
    : null;


/* ---------------------------------------------------------------------
   Menu sanduíche

   Abaixo de 1030px o style.css esconde o menu e passa a bola para o
   botão. O script.js da home faria isso, mas ele também mexe no
   questionário e nas fichas de busca, que não existem aqui.
   --------------------------------------------------------------------- */
const menuBotao = document.querySelector('.menu-botao');
const menu = document.getElementById('menu');

if (menuBotao && menu) {
    const fecharMenu = () => {
        menu.classList.remove('aberto');
        menuBotao.classList.remove('aberto');
        menuBotao.setAttribute('aria-expanded', 'false');
        menuBotao.setAttribute('aria-label', 'Abrir menu');
    };

    menuBotao.addEventListener('click', () => {
        const aberto = menu.classList.toggle('aberto');
        menuBotao.classList.toggle('aberto', aberto);
        menuBotao.setAttribute('aria-expanded', String(aberto));
        menuBotao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    });

    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', fecharMenu));
}


/* ---------------------------------------------------------------------
   As cidades

   A mesma lista do seletor do index.html. Está repetida aqui porque as
   duas páginas não compartilham nenhum arquivo de dados ainda — quando
   a lista passar a vir do banco, na tabela "cidades" do
   01-esquema.sql, os dois lugares somem juntos.
   --------------------------------------------------------------------- */
const CIDADES = {
    'alfenas': 'Alfenas',
    'campos-gerais': 'Campos Gerais',
    'guaxupe': 'Guaxupé',
    'itajuba': 'Itajubá',
    'lavras': 'Lavras',
    'machado': 'Machado',
    'muzambinho': 'Muzambinho',
    'passos': 'Passos',
    'pocos-de-caldas': 'Poços de Caldas',
    'pouso-alegre': 'Pouso Alegre',
    'santa-rita-do-sapucai': 'Santa Rita do Sapucaí',
    'sao-sebastiao-do-paraiso': 'São Sebastião do Paraíso',
    'tres-coracoes': 'Três Corações',
    'varginha': 'Varginha'
};

const COMODOS = {
    'quarto': 'quarto',
    'cozinha': 'cozinha',
    'banheiro': 'banheiro',
    'area-de-servico': 'área de serviço',
    'quintal': 'quintal'
};


/* ---------------------------------------------------------------------
   O que veio da home
   --------------------------------------------------------------------- */
const parametros = new URLSearchParams(window.location.search);

const cidade = CIDADES[parametros.get('cidade')] ? parametros.get('cidade') : '';
const comodo = COMODOS[parametros.get('comodo')] ? parametros.get('comodo') : '';
const modo = parametros.get('modo') === 'desfazendo' ? 'desfazendo' : 'precisando';

const nomeDaCidade = cidade ? CIDADES[cidade] : 'Alfenas e região';

document.getElementById('nomeCidade').textContent = nomeDaCidade;
document.getElementById('nomeCidadeVazio').textContent = nomeDaCidade;

// O caminho de volta leva a cidade junto: quem veio de Alfenas não deve
// voltar para uma página sem cidade escolhida e ter que dizer de novo.
document.getElementById('voltarBusca').href =
    cidade ? `index.html?cidade=${cidade}#republicas` : 'index.html#cidade';

// Quem clicou "Estou desfazendo de" não veio olhar vitrine: veio
// anunciar. A página diz isso na linha fina em vez de mostrar a lista
// de compra e deixar o botão de anunciar no rodapé.
if (modo === 'desfazendo') {
    document.getElementById('linhaFina').textContent =
        'Você está de mudança e quer passar adiante o que não vai levar. '
        + 'Anuncie aqui — quem chega no próximo semestre procura exatamente isso.';
}


/* ---------------------------------------------------------------------
   Os cômodos

   Marca aceso o que veio da home. Trocar de cômodo reescreve o endereço
   em vez de só filtrar na tela: assim o botão de voltar do navegador
   desfaz a escolha, e o link que ele mandar no grupo abre no mesmo
   cômodo que ele estava vendo.
   --------------------------------------------------------------------- */
const fichas = [...document.querySelectorAll('.fichas .ficha')];

fichas.forEach(ficha => {
    ficha.classList.toggle('ativa', ficha.dataset.comodo === comodo);

    ficha.addEventListener('click', () => {
        const query = new URLSearchParams();
        if (cidade) query.set('cidade', cidade);
        if (ficha.dataset.comodo) query.set('comodo', ficha.dataset.comodo);
        if (modo === 'desfazendo') query.set('modo', 'desfazendo');

        const busca = query.toString();
        window.location.href = 'classificados.html' + (busca ? '?' + busca : '');
    });
});


/* ---------------------------------------------------------------------
   A lista

   Ainda não há de onde ler: a tabela dos itens entra no
   supabase/05-classificados.sql, e o projeto do Supabase deste site
   ainda não existe. Enquanto não existir, a página mostra o estado
   vazio de verdade — que é o estado real de uma seção que acabou de
   abrir, e não um defeito.
   --------------------------------------------------------------------- */
const listaVazia = document.getElementById('itensVazio');
const vazioTitulo = document.getElementById('vazioTitulo');
const vazioTexto = document.getElementById('vazioTexto');

function mostrarVazio() {
    const onde = cidade ? `em ${nomeDaCidade}` : 'ainda';

    if (comodo) {
        vazioTitulo.textContent = `Ainda não tem nada para ${COMODOS[comodo]} ${onde}`;
        vazioTexto.textContent =
            'Experimente "Tudo" para ver os outros cômodos. Se você está de '
            + 'mudança e tem algo para passar adiante, anuncie — quem chega no '
            + 'próximo semestre procura exatamente isso.';
    }

    listaVazia.hidden = false;
}

async function carregar() {
    if (!bancoClassificados) {
        mostrarVazio();
        return;
    }

    let consulta = bancoClassificados
        .from('itens')
        .select('id, titulo, preco, comodo, foto_url, whatsapp')
        .eq('publicado', true)
        .order('criado_em', { ascending: false });

    if (cidade) consulta = consulta.eq('cidade', cidade);
    if (comodo) consulta = consulta.eq('comodo', comodo);

    const { data, error } = await consulta;

    // Falhou a rede ou a tabela ainda não existe: mostra o vazio, que é
    // honesto, em vez de um erro que a pessoa não pode resolver.
    if (error || !data || data.length === 0) {
        mostrarVazio();
        return;
    }

    desenhar(data);
}

function desenhar(itens) {
    const lista = document.getElementById('itens');

    lista.replaceChildren(...itens.map(item => {
        const cartao = document.createElement('article');
        cartao.className = 'item';

        const nome = document.createElement('h3');
        nome.textContent = item.titulo;

        const preco = document.createElement('p');
        preco.className = 'item-preco';
        preco.textContent = Number(item.preco) === 0
            ? 'Doação'
            : `R$ ${item.preco}`;

        const onde = document.createElement('p');
        onde.className = 'item-comodo';
        onde.textContent = COMODOS[item.comodo] || '';

        cartao.append(nome, preco, onde);
        return cartao;
    }));

    lista.hidden = false;
    listaVazia.hidden = true;
}

carregar();
