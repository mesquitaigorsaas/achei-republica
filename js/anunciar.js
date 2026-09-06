/* =====================================================================
   Achei República — anunciar nos classificados

   A outra ponta da mesma história: quem está de mudança publica o que
   não vai levar, e quem chega encontra em classificados.html.

   Quem PROCURA não precisa de conta — a vitrine é aberta. Quem PUBLICA
   precisa, e não por burocracia: sem dono não há como tirar do ar
   depois de vender, e numa cidade pequena a geladeira vendida continua
   recebendo mensagem por meses.

   O banco, a máscara de telefone, a busca de CEP e o ocupado() vêm do
   js/conta.js, carregado antes deste. Não recriar nada disso aqui: ele
   já declara "banco" no escopo global, e um segundo const com o mesmo
   nome quebra a página inteira.
   ===================================================================== */

const verificando = document.getElementById('verificando');
const tela = document.getElementById('tela');
const form = document.getElementById('formItem');
const resto = document.getElementById('resto');
const botaoPublicar = document.getElementById('botaoPublicar');
const selCidade = document.getElementById('cidade');
const listaMeus = document.getElementById('meusItens');
const campoPreco = document.getElementById('campoPreco');
const entradaFotos = document.getElementById('fotos');
const previaFotos = document.getElementById('previaFotos');

const janela = document.getElementById('janelaConta');
const recadoCaixa = document.getElementById('recado');
const recadoJanela = document.getElementById('recadoJanela');

const MAX_FOTOS = 3;

let usuario = null;
let comodo = '';
let modo = 'venda';
let escolhidas = [];


/* ---------------------------------------------------------------------
   Recados
   --------------------------------------------------------------------- */
function mostrar(caixa, texto, tipo) {
    caixa.textContent = texto;
    caixa.className = 'recado recado-' + (tipo === 'certo' ? 'certo' : 'erro');
    caixa.hidden = false;
}

const aviso = (texto, tipo) => mostrar(recadoCaixa, texto, tipo);
const avisoNaJanela = (texto, tipo) => mostrar(recadoJanela, texto, tipo);

function limparRecados() {
    recadoCaixa.hidden = true;
    recadoJanela.hidden = true;
}

/* O Supabase responde em inglês. Quem está anunciando um ventilador não
   tem por que ler "Invalid login credentials". */
function traduzirErro(erro) {
    const m = (erro && erro.message || '').toLowerCase();
    if (m.includes('invalid login')) return 'E-mail ou senha não conferem.';
    if (m.includes('already registered')) return 'Já existe conta com esse e-mail. Use "Já tenho conta".';
    if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (m.includes('email')) return 'Confira o e-mail digitado.';
    return erro && erro.message || 'Não consegui completar. Tente de novo.';
}


/* ---------------------------------------------------------------------
   As cidades

   A mesma lista do index.html e do classificados.js. Repetida enquanto
   as três páginas não compartilham um arquivo de dados; some quando
   passar a vir da tabela "cidades".
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
    'quarto': 'Quarto',
    'cozinha': 'Cozinha',
    'banheiro': 'Banheiro',
    'area-de-servico': 'Área de serviço',
    'quintal': 'Quintal'
};

selCidade.replaceChildren(...Object.entries(CIDADES).map(([valor, nome]) => {
    const opcao = document.createElement('option');
    opcao.value = valor;
    opcao.textContent = nome;
    return opcao;
}));

const cidadeDaURL = new URLSearchParams(location.search).get('cidade');
if (cidadeDaURL && CIDADES[cidadeDaURL]) selCidade.value = cidadeDaURL;

/* A volta leva a cidade junto: quem veio anunciar em Varginha não deve
   voltar para uma busca sem cidade escolhida e ter que escolher de
   novo. */
document.getElementById('voltarBusca').href =
    cidadeDaURL && CIDADES[cidadeDaURL]
        ? `index.html?cidade=${cidadeDaURL}#republicas`
        : 'index.html#cidade';


/* ---------------------------------------------------------------------
   As duas escolhas de botão: cômodo e vender/doar
   --------------------------------------------------------------------- */
function ligarEscolhas(caixa, aoEscolher) {
    caixa.addEventListener('click', evento => {
        const botao = evento.target.closest('.escolha');
        if (!botao) return;

        caixa.querySelectorAll('.escolha').forEach(b => b.classList.remove('ativa'));
        botao.classList.add('ativa');
        aoEscolher(botao.dataset.valor);
    });
}

ligarEscolhas(document.getElementById('escolhaComodo'), valor => {
    comodo = valor;
    resto.hidden = false;
    document.getElementById('titulo').focus();
});

ligarEscolhas(document.getElementById('escolhaModo'), valor => {
    modo = valor;
    // Doação não tem preço: o campo some em vez de ficar ali pedindo um
    // número que o banco vai recusar.
    campoPreco.hidden = (modo === 'doacao');
});


/* ---------------------------------------------------------------------
   As fotos — até três

   A prévia existe para ele conferir ANTES de publicar que mandou a
   foto certa. Foto de galeria de celular é fácil de errar.
   --------------------------------------------------------------------- */
entradaFotos.addEventListener('change', () => {
    const novas = Array.from(entradaFotos.files);
    escolhidas = novas.slice(0, MAX_FOTOS);

    if (novas.length > MAX_FOTOS) {
        aviso(`São no máximo ${MAX_FOTOS} fotos. Peguei as ${MAX_FOTOS} primeiras.`, 'certo');
    }

    previaFotos.replaceChildren(...escolhidas.map(arquivo => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(arquivo);
        img.alt = '';
        // Sem isto, cada troca de seleção deixa a anterior presa na
        // memória do navegador até a página ser fechada.
        img.addEventListener('load', () => URL.revokeObjectURL(img.src));
        return img;
    }));
});


/* ---------------------------------------------------------------------
   O pop-up de conta
   --------------------------------------------------------------------- */
function abrirJanela() {
    janela.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('jEmail').focus();
}

function fecharJanela() {
    janela.hidden = true;
    document.body.style.overflow = '';
}

janela.querySelectorAll('[data-fecha-janela]').forEach(alvo => {
    alvo.addEventListener('click', () => {
        // Fechar sem entrar devolve para a vitrine: ficar numa página de
        // anunciar que não deixa anunciar é um beco.
        location.href = 'classificados.html';
    });
});

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !janela.hidden) location.href = 'classificados.html';
});

const formEntrar = document.getElementById('formEntrar');
const formCriar = document.getElementById('formCriar');

document.querySelectorAll('.aba').forEach(aba => {
    aba.addEventListener('click', () => {
        document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
        aba.classList.add('ativa');

        const criando = aba.dataset.aba === 'criar';
        formEntrar.hidden = criando;
        formCriar.hidden = !criando;
        recadoJanela.hidden = true;
    });
});

formEntrar.addEventListener('submit', async evento => {
    evento.preventDefault();
    limparRecados();

    const botao = document.getElementById('botaoEntrar');
    ocupado(botao, true, 'Entrando...');

    const { error } = await banco.auth.signInWithPassword({
        email: document.getElementById('jEmail').value.trim(),
        password: document.getElementById('jSenha').value
    });

    ocupado(botao, false);

    if (error) {
        avisoNaJanela(traduzirErro(error));
        return;
    }

    fecharJanela();
    entrar();
});

formCriar.addEventListener('submit', async evento => {
    evento.preventDefault();
    limparRecados();

    const nome = document.getElementById('cNome').value.trim();
    const whatsapp = document.getElementById('cWhatsapp').value.replace(/\D/g, '');
    const email = document.getElementById('cEmail').value.trim();
    const senha = document.getElementById('cSenha').value;

    if (nome.length < 2)      return avisoNaJanela('Escreva seu nome.');
    if (whatsapp.length < 10) return avisoNaJanela('O WhatsApp precisa de DDD e número.');
    if (senha.length < 6)     return avisoNaJanela('A senha precisa de pelo menos 6 caracteres.');

    const botao = document.getElementById('botaoCriar');
    ocupado(botao, true, 'Criando...');

    const { data, error } = await banco.auth.signUp({ email, password: senha });

    if (error) {
        ocupado(botao, false);
        avisoNaJanela(traduzirErro(error));
        return;
    }

    /* Sem sessão na volta, o projeto está exigindo confirmação por
       e-mail. A conta existe, mas ela não pode publicar agora — e
       dizer isso é melhor que deixá-la clicando num botão que não
       responde. */
    if (!data.session) {
        ocupado(botao, false);
        avisoNaJanela('Conta criada. Confirme pelo link que enviamos no seu e-mail '
                     + 'e volte aqui para publicar.', 'certo');
        return;
    }

    // O perfil guarda o que ela acabou de digitar, para não pedir de
    // novo na próxima vez. Se falhar, o anúncio ainda pode sair: o que
    // o item precisa é do WhatsApp, e esse vai no próprio anúncio.
    await banco.from('perfis').upsert({
        id: data.session.user.id,
        nome,
        telefone: whatsapp,
        cep: document.getElementById('cCep').value.replace(/\D/g, '') || null,
        logradouro: document.getElementById('cLogradouro').value.trim() || null,
        numero: document.getElementById('cNumero').value.trim() || null,
        bairro: document.getElementById('cBairro').value.trim() || null,
        cidade: document.getElementById('cCidade').value.trim() || null,
        uf: document.getElementById('cUf').value.trim() || null
    });

    ocupado(botao, false);
    fecharJanela();
    entrar();
});

// CEP preenche o endereço, usando o buscarCep() do conta.js.
const campoCep = document.getElementById('cCep');
campoCep.addEventListener('blur', () => buscarCep(campoCep.value, {
    logradouro: document.getElementById('cLogradouro'),
    bairro: document.getElementById('cBairro'),
    cidade: document.getElementById('cCidade'),
    uf: document.getElementById('cUf'),
    numero: document.getElementById('cNumero')
}));


/* ---------------------------------------------------------------------
   Publicar
   --------------------------------------------------------------------- */
form.addEventListener('submit', async evento => {
    evento.preventDefault();
    limparRecados();

    const titulo = document.getElementById('titulo').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.replace(/\D/g, '');
    const preco = modo === 'doacao' ? 0 : Number(document.getElementById('preco').value) || 0;

    if (!comodo)              return aviso('Escolha de qual cômodo é.');
    if (titulo.length < 3)    return aviso('Escreva o que você está anunciando.');
    if (whatsapp.length < 10) return aviso('O WhatsApp precisa de DDD e número.');

    ocupado(botaoPublicar, true, 'Publicando...');

    const fotos = [];
    const falhas = [];

    // Uma de cada vez, e não as três juntas: são fotos de celular de
    // vários MB, e três subindo em paralelo numa internet de cidade
    // pequena travam as três.
    for (const arquivo of escolhidas) {
        const resultado = await subirFoto(arquivo);
        if (resultado.url) fotos.push(resultado.url);
        else falhas.push(resultado.erro);
    }

    const { error } = await banco.from('itens').insert({
        dono_id: usuario.id,
        cidade: selCidade.value,
        comodo,
        titulo,
        descricao: document.getElementById('descricao').value.trim(),
        modo,
        preco,
        fotos,
        whatsapp,
        publicado: true
    });

    ocupado(botaoPublicar, false);

    if (error) {
        aviso('Não consegui publicar: ' + error.message);
        return;
    }

    form.reset();
    resto.hidden = true;
    comodo = '';
    escolhidas = [];
    previaFotos.replaceChildren();
    document.querySelectorAll('#escolhaComodo .escolha').forEach(b => b.classList.remove('ativa'));
    if (cidadeDaURL && CIDADES[cidadeDaURL]) selCidade.value = cidadeDaURL;

    /* A falha da foto vem com o motivo. Antes dizia só "não subiu", e
       um "não subiu" sem motivo não dá para consertar — nem por quem
       está anunciando, nem por quem fez o site. */
    aviso(falhas.length === 0
        ? 'Anúncio no ar. Quem procurar esse cômodo na sua cidade vai ver.'
        : `Anúncio no ar, mas ${falhas.length} foto${falhas.length > 1 ? 's' : ''} `
          + `não subiu. Motivo: ${falhas[0]}`, 'certo');

    carregarMeus();
});

/* A foto vai para o bucket "itens", numa pasta com o id do dono — é
   isso que as regras do 06-fotos-dos-itens.sql checam. O nome tem hora
   e um pedaço aleatório: duas pessoas mandando "geladeira.jpg" no
   mesmo minuto não podem sobrescrever uma à outra. */
async function subirFoto(arquivo) {
    const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
    const nome = `${usuario.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extensao}`;

    const { error } = await banco.storage.from('itens')
        .upload(nome, arquivo, { cacheControl: '3600', upsert: false });

    if (error) {
        // Vai para o console também: a pessoa lê a frase curta na tela,
        // e quem for consertar precisa do objeto inteiro.
        console.error('Falhou o envio da foto:', error);
        return { url: null, erro: error.message || 'erro sem mensagem' };
    }

    return {
        url: banco.storage.from('itens').getPublicUrl(nome).data.publicUrl,
        erro: null
    };
}


/* ---------------------------------------------------------------------
   Os anúncios dele
   --------------------------------------------------------------------- */
async function carregarMeus() {
    const { data, error } = await banco
        .from('itens')
        .select('id, titulo, preco, modo, cidade, comodo, publicado, fotos')
        .eq('dono_id', usuario.id)
        .order('criado_em', { ascending: false });

    if (error) {
        listaMeus.textContent = 'Não consegui carregar seus anúncios: ' + error.message;
        return;
    }

    if (!data || data.length === 0) {
        listaMeus.innerHTML = '<p class="conta-linha-fina">Você ainda não anunciou nada. '
            + 'O primeiro aparece aqui assim que você publicar.</p>';
        return;
    }

    listaMeus.replaceChildren(...data.map(montarLinha));
}

function montarLinha(item) {
    const linha = document.createElement('div');
    linha.className = 'meu-item';

    const texto = document.createElement('div');

    const nome = document.createElement('strong');
    nome.textContent = item.titulo;

    const detalhe = document.createElement('span');
    detalhe.className = 'meu-item-detalhe';
    detalhe.textContent = [
        item.modo === 'doacao' ? 'Doação' : `R$ ${item.preco}`,
        COMODOS[item.comodo] || '',
        CIDADES[item.cidade] || item.cidade,
        (item.fotos && item.fotos.length) ? `${item.fotos.length} foto${item.fotos.length > 1 ? 's' : ''}` : 'sem foto',
        item.publicado ? null : 'fora do ar'
    ].filter(Boolean).join(' · ');

    texto.append(nome, detalhe);

    const acoes = document.createElement('div');
    acoes.className = 'meu-item-acoes';

    // "Já vendi" tira da vitrine sem apagar: ele continua vendo aqui e
    // pode colocar de volta se a venda não se confirmar.
    const alternar = document.createElement('button');
    alternar.type = 'button';
    alternar.className = 'btn';
    alternar.textContent = item.publicado ? 'Já vendi' : 'Anunciar de novo';
    alternar.addEventListener('click', () => alternarNoAr(item, !item.publicado, alternar));

    const apagar = document.createElement('button');
    apagar.type = 'button';
    apagar.className = 'btn btn-perigo';
    apagar.textContent = 'Apagar';
    apagar.addEventListener('click', () => remover(item));

    acoes.append(alternar, apagar);
    linha.append(texto, acoes);
    return linha;
}

async function alternarNoAr(item, novoEstado, botao) {
    ocupado(botao, true, '...');

    const { error } = await banco.from('itens')
        .update({ publicado: novoEstado }).eq('id', item.id);

    ocupado(botao, false);

    if (error) {
        aviso('Não consegui mudar: ' + error.message);
        return;
    }

    carregarMeus();
}

async function remover(item) {
    if (!window.confirm(`Apagar "${item.titulo}"? Isso não tem como desfazer.`)) return;

    const { error } = await banco.from('itens').delete().eq('id', item.id);

    if (error) {
        aviso('Não consegui apagar: ' + error.message);
        return;
    }

    aviso('Anúncio apagado.', 'certo');
    carregarMeus();
}


/* ---------------------------------------------------------------------
   Entrada
   --------------------------------------------------------------------- */
async function entrar() {
    const { data } = await banco.auth.getSession();
    if (!data.session) return;

    usuario = data.session.user;

    verificando.hidden = true;
    tela.hidden = false;
    document.getElementById('botaoSair').hidden = false;

    // O WhatsApp do perfil já vem no campo: quem acabou de cadastrar
    // não deve digitar o próprio número duas vezes seguidas.
    const { data: perfil } = await banco
        .from('perfis').select('telefone').eq('id', usuario.id).maybeSingle();

    if (perfil && perfil.telefone) {
        document.getElementById('whatsapp').value = mascararTelefone(perfil.telefone);
    }

    carregarMeus();
}

document.getElementById('botaoSair').addEventListener('click', async () => {
    await banco.auth.signOut();
    location.href = 'index.html';
});

(async () => {
    if (!banco) {
        verificando.textContent = 'O site ainda não está ligado ao banco de dados.';
        return;
    }

    const { data } = await banco.auth.getSession();

    if (data.session) {
        entrar();
    } else {
        verificando.hidden = true;
        abrirJanela();
    }
})();
