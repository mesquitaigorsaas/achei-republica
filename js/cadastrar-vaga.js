/* =====================================================================
   Achei República — cadastrar e editar a vaga

   A ponta que faltava. Quem tem quarto vago publica aqui, e o anúncio
   aparece na vitrine da home da cidade dele.

   É uma página diferente do anunciar.html de propósito. Quem está se
   desfazendo de uma geladeira e quem está oferecendo um lugar para
   morar não respondem às mesmas perguntas: a geladeira quer foto e
   preço; a casa quer quantos minutos até a faculdade, quem mora nela,
   o endereço e cinquenta características que viram filtro.

   A mesma página edita: cadastrar-vaga.html?id=<uuid> abre o anúncio
   preenchido. Sem isso, corrigir um preço exigiria apagar e refazer —
   e refazer perde as fotos, as marcas e a data em que o anúncio nasceu.

   O banco, a máscara de telefone, a busca de CEP e o ocupado() vêm do
   js/conta.js, carregado antes deste. O vocabulário (TIPOS, PERFIS,
   MODOS, COMPOSICOES, MARCAS) vem do js/marcas.js.
   ===================================================================== */

const verificando = document.getElementById('verificando');
const tela = document.getElementById('tela');
const form = document.getElementById('formVaga');
const resto = document.getElementById('resto');
const botaoPublicar = document.getElementById('botaoPublicar');
const selCidade = document.getElementById('cidade');
const selFaculdade = document.getElementById('faculdade');
const dicaFaculdade = document.getElementById('dicaFaculdade');
const selModo = document.getElementById('modo');
const listaMinhas = document.getElementById('minhasVagas');
const entradaFotos = document.getElementById('fotos');
const previaFotos = document.getElementById('previaFotos');

const janela = document.getElementById('janelaConta');
const recadoCaixa = document.getElementById('recado');
const recadoJanela = document.getElementById('recadoJanela');

const MAX_FOTOS = 5;

let usuario = null;
let tipo = '';
let perfil = 'mista';
let composicao = '';
let escolhidas = [];       // arquivos novos, ainda não enviados
let jaNoAr = [];           // fotos que já estão no banco: { id, caminho }
let paraApagar = [];       // ids de foto que a pessoa tirou durante a edição
let cidades = [];

/* Quantos anúncios no ar esta conta pode ter. Um, salvo liberação
   feita à mão por você no banco. Quem faz valer é o gatilho do
   10-um-anuncio-por-conta.sql; aqui o número serve só para avisar
   antes, em vez de deixar a pessoa descobrir no botão. */
let limiteDaConta = 1;

/* Quando isto tem valor, a página está editando um anúncio que já
   existe em vez de criar um novo. Muda o texto do botão, o que o envio
   faz e o que a página carrega na abertura. */
let editandoId = new URLSearchParams(location.search).get('id');


/* ---------------------------------------------------------------------
   Recados
   --------------------------------------------------------------------- */
function mostrar(caixa, texto, tipoDeRecado) {
    caixa.textContent = texto;
    caixa.className = 'recado recado-' + (tipoDeRecado === 'certo' ? 'certo' : 'erro');
    caixa.hidden = false;
    caixa.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

const aviso = (texto, tipoDeRecado) => mostrar(recadoCaixa, texto, tipoDeRecado);
const avisoNaJanela = (texto, tipoDeRecado) => mostrar(recadoJanela, texto, tipoDeRecado);

function limparRecados() {
    recadoCaixa.hidden = true;
    recadoJanela.hidden = true;
}

/* O Supabase responde em inglês. Quem está anunciando um quarto não tem
   por que ler "Invalid login credentials". */
function traduzirErro(erro) {
    const m = (erro && erro.message ? erro.message : '').toLowerCase();
    if (m.includes('invalid login')) return 'E-mail ou senha não conferem.';
    if (m.includes('email not confirmed')) return 'Falta confirmar o e-mail. Veja o link que enviamos.';
    if (m.includes('already registered')) return 'Esse e-mail já tem conta. Entre pela outra aba.';
    if (m.includes('password')) return 'A senha precisa de pelo menos 6 caracteres.';
    if (m.includes('no_ar_tem_endereco')) return 'Anúncio no ar precisa de rua e número.';
    if (m.includes('moradores_plausivel')) return 'Quantos moram tem que ser entre 0 e 30.';
    // A etiqueta vem do gatilho do 10-um-anuncio-por-conta.sql.
    if (m.includes('limite_de_anuncios')) {
        return 'Sua conta já tem anúncio no ar. Tire o atual do ar, ou me chame '
             + 'no WhatsApp para liberar a conta se você tem mais de uma república.';
    }
    return erro && erro.message ? erro.message : 'Não deu certo. Tente de novo.';
}


/* ---------------------------------------------------------------------
   As escolhas de botão, montadas pelo vocabulário

   Tipo, perfil e composição são colunas com check constraint no banco.
   Escrever as opções à mão no HTML deixaria dois lugares para errar;
   saindo daqui, o apelido gravado é sempre um dos que o banco aceita.
   --------------------------------------------------------------------- */
function montarEscolhas(caixa, opcoes, aoEscolher, jaEscolhido) {
    caixa.replaceChildren(...opcoes.map(([apelido, nome]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'escolha' + (apelido === jaEscolhido ? ' ativa' : '');
        b.dataset.valor = apelido;
        b.textContent = nome;
        b.addEventListener('click', () => {
            caixa.querySelectorAll('.escolha').forEach(o => o.classList.remove('ativa'));
            b.classList.add('ativa');
            aoEscolher(apelido);
        });
        return b;
    }));
}

/* Acende um botão pelo apelido, sem disparar clique. Usado ao abrir um
   anúncio para editar: a escolha que estava gravada tem que aparecer
   acesa, senão a pessoa acha que perdeu a resposta. */
function acender(caixa, valor) {
    caixa.querySelectorAll('.escolha').forEach(b => {
        b.classList.toggle('ativa', b.dataset.valor === valor);
    });
}

const caixaTipo = document.getElementById('escolhaTipo');
const caixaPerfil = document.getElementById('escolhaPerfil');
const caixaComposicao = document.getElementById('escolhaComposicao');

montarEscolhas(caixaTipo, TIPOS, valor => {
    tipo = valor;
    // O resto do formulário só abre depois da primeira escolha: um
    // formulário deste tamanho aberto de cara é uma parede.
    resto.hidden = false;
    limparRecados();
});

montarEscolhas(caixaPerfil, PERFIS, valor => { perfil = valor; }, 'mista');
montarEscolhas(caixaComposicao, COMPOSICOES, valor => { composicao = valor; });

selModo.replaceChildren(...MODOS.map(([apelido, nome]) => {
    const o = document.createElement('option');
    o.value = apelido;
    o.textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
    return o;
}));


/* ---------------------------------------------------------------------
   As características

   Uma caixa por grupo, na mesma ordem em que aparecem nos filtros da
   busca. Quem cadastra e quem procura veem a mesma lista, na mesma
   ordem — é o que faz a pessoa reconhecer o próprio anúncio quando
   filtra depois para conferir.
   --------------------------------------------------------------------- */
const caixaMarcas = document.getElementById('marcas');

caixaMarcas.replaceChildren(...MARCAS.map(grupo => {
    const bloco = document.createElement('div');
    bloco.className = 'grupo-marcas';

    const titulo = document.createElement('h4');
    titulo.textContent = grupo.grupo;
    bloco.appendChild(titulo);

    if (grupo.dica) {
        const dica = document.createElement('p');
        dica.className = 'conta-linha-fina';
        dica.textContent = grupo.dica;
        bloco.appendChild(dica);
    }

    const caixa = document.createElement('div');
    caixa.className = 'marcas-grade';

    grupo.itens.forEach(([apelido, nome]) => {
        const item = document.createElement('label');
        item.className = 'marca-item';

        const caixinha = document.createElement('input');
        caixinha.type = 'checkbox';
        caixinha.value = apelido;
        caixinha.dataset.marca = '1';

        const texto = document.createElement('span');
        texto.textContent = nome;

        item.append(caixinha, texto);
        caixa.appendChild(item);
    });

    bloco.appendChild(caixa);
    return bloco;
}));

function marcasEscolhidas() {
    return [...caixaMarcas.querySelectorAll('input[data-marca]:checked')].map(c => c.value);
}


/* ---------------------------------------------------------------------
   Cidades e faculdades, do banco

   Aqui não dá para usar a lista fixa que a home usa: o cadastro precisa
   do id da cidade, e id é coisa que só o banco sabe.
   --------------------------------------------------------------------- */
async function carregarCidades() {
    const { data, error } = await banco
        .from('cidades')
        .select('id, nome, slug')
        .order('nome');

    if (error || !data || !data.length) {
        aviso('Não consegui carregar a lista de cidades. Recarregue a página.');
        return false;
    }

    cidades = data;
    selCidade.replaceChildren(...data.map(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.nome;
        o.dataset.slug = c.slug;
        return o;
    }));

    // Veio de "index.html?cidade=alfenas": já chega na cidade certa.
    const daURL = new URLSearchParams(location.search).get('cidade');
    const achada = data.find(c => c.slug === daURL);
    if (achada) selCidade.value = achada.id;

    await carregarFaculdades();
    return true;
}

async function carregarFaculdades(manter) {
    const { data } = await banco
        .from('faculdades')
        .select('id, nome, sigla')
        .eq('cidade_id', selCidade.value)
        .order('sigla');

    const nenhuma = !data || !data.length;

    selFaculdade.replaceChildren();

    // Cidade sem faculdade cadastrada: o campo some em vez de virar um
    // seletor vazio que a pessoa abre e fecha sem entender.
    selFaculdade.hidden = nenhuma;
    if (nenhuma) {
        dicaFaculdade.textContent =
            'Ainda não temos faculdade cadastrada nesta cidade — pode deixar em branco.';
        return;
    }

    const vazia = document.createElement('option');
    vazia.value = '';
    vazia.textContent = 'Escolha';
    selFaculdade.appendChild(vazia);

    data.forEach(f => {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = `${f.sigla} — ${f.nome}`;
        selFaculdade.appendChild(o);
    });

    if (manter && data.some(f => f.id === manter)) selFaculdade.value = manter;

    dicaFaculdade.textContent =
        'Metade da nota de compatibilidade sai daqui. Quem sabe o caminho é você.';
}

selCidade.addEventListener('change', () => carregarFaculdades());

/* O CEP preenche rua e bairro. A cidade NÃO é preenchida por ele de
   propósito: aqui ela é um <select> cujos valores são identificadores
   do banco, e escrever "Alfenas" dentro dele zeraria a escolha. Os dois
   campos escondidos existem só para o buscarCep() do conta.js ter onde
   despejar cidade e UF sem quebrar. */
const campoCepDaCasa = document.getElementById('cep');
campoCepDaCasa.addEventListener('blur', () => buscarCep(campoCepDaCasa.value, {
    logradouro: document.getElementById('logradouro'),
    bairro: document.getElementById('bairro'),
    cidade: document.getElementById('endCidadeTexto'),
    uf: document.getElementById('endUf'),
    numero: document.getElementById('numero')
}));


/* ---------------------------------------------------------------------
   As fotos — até cinco, somando as que já estão no ar
   --------------------------------------------------------------------- */
function totalDeFotos() {
    return jaNoAr.length + escolhidas.length;
}

entradaFotos.addEventListener('change', () => {
    limparRecados();
    const novas = [...entradaFotos.files];
    const cabem = MAX_FOTOS - totalDeFotos();

    if (novas.length > cabem) {
        aviso(cabem > 0
            ? `São no máximo ${MAX_FOTOS} fotos. Peguei as ${cabem} que couberam.`
            : `Já são ${MAX_FOTOS} fotos. Tire uma antes de pôr outra.`, 'certo');
    }

    escolhidas = [...escolhidas, ...novas.slice(0, Math.max(cabem, 0))];

    // O input é zerado para a pessoa poder escolher o mesmo arquivo de
    // novo depois de tirá-lo da lista — sem isso o "change" não dispara.
    entradaFotos.value = '';
    desenharPrevia();
});

function desenharPrevia() {
    const molduras = [];

    // Primeiro as que já estão no ar, na ordem em que foram gravadas.
    jaNoAr.forEach((foto, i) => {
        molduras.push(moldura(foto.caminho, i === 0, () => {
            paraApagar.push(foto.id);
            jaNoAr = jaNoAr.filter(f => f.id !== foto.id);
            desenharPrevia();
        }, `Foto ${i + 1}, já publicada`));
    });

    escolhidas.forEach((arquivo, i) => {
        const url = URL.createObjectURL(arquivo);
        molduras.push(moldura(url, jaNoAr.length === 0 && i === 0, () => {
            escolhidas.splice(i, 1);
            desenharPrevia();
        }, `Foto nova ${i + 1}`, true));
    });

    previaFotos.replaceChildren(...molduras);
}

function moldura(url, ehCapa, aoTirar, rotulo, soltarDepois) {
    const caixa = document.createElement('div');
    caixa.className = 'previa-item';

    const img = document.createElement('img');
    img.src = url;
    img.alt = rotulo;
    // Solta a memória do arquivo local assim que o navegador desenhou.
    if (soltarDepois) img.onload = () => URL.revokeObjectURL(url);

    const tirar = document.createElement('button');
    tirar.type = 'button';
    tirar.className = 'previa-x';
    tirar.setAttribute('aria-label', `Tirar a ${rotulo}`);
    tirar.textContent = '×';
    tirar.addEventListener('click', aoTirar);

    // A primeira é a que aparece no cartão da busca. Dizer isso evita o
    // anúncio nascer com a foto do banheiro na frente.
    if (ehCapa) {
        const selo = document.createElement('span');
        selo.className = 'previa-selo';
        selo.textContent = 'Capa';
        caixa.appendChild(selo);
    }

    caixa.append(img, tirar);
    return caixa;
}


/* ---------------------------------------------------------------------
   Publicar ou salvar
   --------------------------------------------------------------------- */
form.addEventListener('submit', async evento => {
    evento.preventDefault();
    limparRecados();

    /* Quem fechou o pop-up com o Cancelar continua vendo o formulário
       inteiro por trás dele. Sem esta linha, enviar dali estouraria num
       "usuario is null" e a pessoa veria a página não fazer nada. */
    if (!usuario) {
        abrirJanela();
        return;
    }

    const campos = {
        cidade_id: selCidade.value,
        faculdade_id: selFaculdade.hidden ? null : (selFaculdade.value || null),
        nome: document.getElementById('nome').value.trim(),
        bairro: document.getElementById('bairro').value.trim(),
        cep: document.getElementById('cep').value.replace(/\D/g, '') || null,
        logradouro: document.getElementById('logradouro').value.trim(),
        numero: document.getElementById('numero').value.trim(),
        complemento: document.getElementById('complemento').value.trim() || null,
        descricao: document.getElementById('descricao').value.trim() || null,
        tipo,
        perfil,
        composicao: composicao || null,
        moradores: document.getElementById('moradores').value === ''
            ? null : Number(document.getElementById('moradores').value),
        preco: Number(document.getElementById('preco').value) || 0,
        caucao: Number(document.getElementById('caucao').value) || 0,
        vagas: Number(document.getElementById('vagas').value) || 1,
        minutos: Number(document.getElementById('minutos').value) || null,
        modo: selModo.value,
        disponivel_em: document.getElementById('disponivel').value || null,
        whatsapp: document.getElementById('whatsapp').value.replace(/\D/g, '')
    };

    if (!tipo)                    return aviso('Escolha o que você está oferecendo.');
    if (campos.nome.length < 2)   return aviso('Escreva o nome da casa.');
    if (!campos.logradouro)       return aviso('Escreva a rua da casa.');
    if (!campos.numero)           return aviso('Escreva o número da casa.');
    if (!campos.bairro)           return aviso('Escreva o bairro — é o que a pessoa procura primeiro.');
    if (!campos.composicao)       return aviso('Diga quem mora na casa.');
    if (campos.moradores === null) return aviso('Diga quantas pessoas moram hoje. Zero também é resposta.');
    if (campos.preco <= 0)        return aviso('Escreva o valor do aluguel.');
    if (campos.whatsapp.length < 10) return aviso('O WhatsApp precisa de DDD e número.');

    ocupado(botaoPublicar, true, editandoId ? 'Salvando...' : 'Publicando...');

    const { data: vaga, error } = editandoId
        ? await banco.from('republicas').update(campos)
            .eq('id', editandoId).select('id, status').single()
        : await banco.from('republicas').insert({ dono_id: usuario.id, ...campos })
            .select('id, status').single();

    if (error) {
        ocupado(botaoPublicar, false);
        console.error('Falhou ao salvar a vaga:', error);
        return aviso('Não consegui salvar: ' + traduzirErro(error));
    }

    const falhas = await salvarOsPedacos(vaga.id);

    ocupado(botaoPublicar, false);

    /* A triagem do 04-anunciante.sql pode ter mandado o anúncio para a
       fila — do terceiro em diante, ou quando o texto tem cara de
       imobiliária. Dizer isso é obrigação: o dono vai procurar a casa na
       busca e não vai achar, e sem explicação isso parece bug. */
    let recado;
    if (vaga.status === 'em_revisao') {
        recado = 'Salvo, e em revisão. O anúncio ainda não aparece na busca — '
               + 'a gente olha e libera. Isso acontece a partir do terceiro anúncio.';
    } else if (editandoId) {
        recado = 'Alterações salvas. Quem abrir a vaga já vê o novo.';
    } else {
        recado = 'Vaga no ar. Quem procurar república nessa cidade já vai ver a sua.';
    }

    if (falhas.length) recado += ' Só não consegui gravar ' + falhas.join(' e ') + '.';

    aviso(recado, 'certo');

    if (editandoId) {
        // Continua editando o mesmo anúncio: as fotos que subiram agora
        // passam a ser "já no ar", e a lista se refaz do banco.
        await carregarParaEditar(editandoId, true);
    } else {
        limparFormulario();
    }

    carregarMinhas();
});


/* As tabelas filhas vão depois da principal, e cada uma pode falhar
   sozinha. Um erro aqui NÃO derruba o anúncio — ele já está gravado, e
   uma casa no ar sem a etiqueta "aceita pet" é melhor que casa nenhuma.
   O que não pode é a pessoa achar que gravou o que não gravou. */
async function salvarOsPedacos(vagaId) {
    const falhas = [];

    // Na edição, marcas e cursos são reescritos por inteiro. Comparar o
    // que mudou daria o mesmo resultado com três vezes mais código, e
    // são listas de dez linhas.
    if (editandoId) {
        await banco.from('republica_marcas').delete().eq('republica_id', vagaId);
        await banco.from('republica_cursos').delete().eq('republica_id', vagaId);
    }

    const marcas = marcasEscolhidas();
    if (marcas.length) {
        const { error } = await banco.from('republica_marcas')
            .insert(marcas.map(marca => ({ republica_id: vagaId, marca })));
        if (error) falhas.push('as características');
    }

    const cursos = document.getElementById('cursos').value
        .split(',').map(c => c.trim()).filter(Boolean);
    if (cursos.length) {
        const { error } = await banco.from('republica_cursos')
            .insert(cursos.map(curso => ({ republica_id: vagaId, curso })));
        if (error) falhas.push('os cursos');
    }

    // As fotas tiradas durante a edição saem do banco E do balde: linha
    // apagada com arquivo esquecido enche o armazenamento com foto que
    // ninguém mais consegue ver.
    for (const id of paraApagar) {
        const foto = (await banco.from('republica_fotos')
            .select('caminho').eq('id', id).maybeSingle()).data;

        await banco.from('republica_fotos').delete().eq('id', id);
        if (foto) {
            const caminho = caminhoNoBalde(foto.caminho);
            if (caminho) await banco.storage.from('republicas').remove([caminho]);
        }
    }
    paraApagar = [];

    // Uma foto de cada vez, e não as cinco juntas: são fotos de celular
    // de vários MB, e cinco subindo em paralelo numa internet de cidade
    // pequena travam as cinco.
    let subiram = 0;
    for (let i = 0; i < escolhidas.length; i++) {
        const caminho = await subirFoto(escolhidas[i], vagaId);
        if (!caminho) continue;

        const { error } = await banco.from('republica_fotos')
            .insert({ republica_id: vagaId, caminho, ordem: jaNoAr.length + i });
        if (!error) subiram++;
    }
    if (subiram < escolhidas.length) falhas.push('parte das fotos');
    escolhidas = [];

    return falhas;
}


/* O caminho começa com o id do dono e é isso que as regras do
   08-fotos-das-republicas.sql conferem. Depois vem o id da vaga, para
   as fotos de casas diferentes não se misturarem na mesma pasta. */
async function subirFoto(arquivo, vagaId) {
    const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
    const nome = `${usuario.id}/${vagaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;

    const { error } = await banco.storage.from('republicas')
        .upload(nome, arquivo, { cacheControl: '3600', upsert: false });

    if (error) {
        console.error('Falhou o envio da foto:', error);
        return null;
    }

    return banco.storage.from('republicas').getPublicUrl(nome).data.publicUrl;
}

/* A coluna guarda o endereço público inteiro; o balde quer só o pedaço
   depois do nome dele. Um devolve o outro sem precisar de outra coluna
   para o mesmo dado. */
function caminhoNoBalde(url) {
    const marca = '/republicas/';
    const corte = String(url || '').lastIndexOf(marca);
    return corte === -1 ? null : url.slice(corte + marca.length);
}


function limparFormulario() {
    form.reset();
    escolhidas = [];
    jaNoAr = [];
    paraApagar = [];
    desenharPrevia();
    caixaMarcas.querySelectorAll('input[data-marca]').forEach(c => { c.checked = false; });
    tipo = '';
    composicao = '';
    perfil = 'mista';
    acender(caixaTipo, '');
    acender(caixaComposicao, '');
    acender(caixaPerfil, 'mista');
    resto.hidden = true;
}


/* ---------------------------------------------------------------------
   Abrir um anúncio para editar
   --------------------------------------------------------------------- */
async function carregarParaEditar(id, silencioso) {
    const { data, error } = await banco
        .from('republicas')
        .select(`*, republica_fotos ( id, caminho, ordem ),
                    republica_marcas ( marca ),
                    republica_cursos ( curso )`)
        .eq('id', id)
        .maybeSingle();

    // Anúncio de outra pessoa não volta nada: a regra de leitura do
    // banco só devolve o próprio para quem está fora do ar. Cair aqui
    // quer dizer "não é seu" ou "não existe".
    if (error || !data) {
        editandoId = null;
        botaoPublicar.textContent = 'Publicar a vaga';
        if (!silencioso) aviso('Não achei esse anúncio na sua conta. Você pode cadastrar um novo abaixo.');
        return;
    }

    editandoId = id;
    botaoPublicar.textContent = 'Salvar alterações';
    document.querySelector('.conta-titulo').textContent = 'Editando: ' + data.nome;

    tipo = data.tipo || '';
    perfil = data.perfil || 'mista';
    composicao = data.composicao || '';
    acender(caixaTipo, tipo);
    acender(caixaPerfil, perfil);
    acender(caixaComposicao, composicao);
    resto.hidden = !tipo;

    const por = (campo, valor) => {
        const el = document.getElementById(campo);
        if (el) el.value = valor === null || valor === undefined ? '' : valor;
    };

    por('nome', data.nome);
    por('bairro', data.bairro);
    por('cep', data.cep ? mascararCep(data.cep) : '');
    por('logradouro', data.logradouro);
    por('numero', data.numero);
    por('complemento', data.complemento);
    por('descricao', data.descricao);
    por('moradores', data.moradores);
    por('preco', data.preco === null ? '' : Number(data.preco));
    por('caucao', data.caucao === null ? '' : Number(data.caucao));
    por('vagas', data.vagas);
    por('minutos', data.minutos);
    por('disponivel', data.disponivel_em);
    por('whatsapp', data.whatsapp ? mascararTelefone(data.whatsapp) : '');

    selCidade.value = data.cidade_id;
    await carregarFaculdades(data.faculdade_id);
    selModo.value = data.modo || 'pe';

    por('cursos', (data.republica_cursos || []).map(c => c.curso).join(', '));

    const marcas = new Set((data.republica_marcas || []).map(m => m.marca));
    caixaMarcas.querySelectorAll('input[data-marca]').forEach(c => {
        c.checked = marcas.has(c.value);
    });

    jaNoAr = (data.republica_fotos || [])
        .slice()
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    escolhidas = [];
    paraApagar = [];
    desenharPrevia();

    if (!silencioso) form.scrollIntoView({ block: 'start', behavior: 'smooth' });
}


/* ---------------------------------------------------------------------
   Suas vagas

   Existe pelo mesmo motivo que a conta existe: no dia em que alugar, a
   pessoa precisa tirar do ar. Sem esta lista, a vaga alugada continua
   recebendo mensagem por meses — e é o anunciante que fica com fama de
   quem não responde.
   --------------------------------------------------------------------- */
async function carregarMinhas() {
    const { data, error } = await banco
        .from('republicas')
        .select('id, nome, bairro, preco, vagas, ativa, status, cidade_id')
        .eq('dono_id', usuario.id)
        .order('criada_em', { ascending: false });

    if (error) {
        listaMinhas.textContent = 'Não consegui carregar suas vagas: ' + error.message;
        return;
    }

    if (!data || !data.length) {
        listaMinhas.innerHTML =
            '<p class="conta-linha-fina">Você ainda não cadastrou nenhuma vaga. '
            + 'A primeira aparece aqui assim que publicar.</p>';
        return;
    }

    conferirLimite(data.filter(v => v.ativa).length);

    listaMinhas.replaceChildren(...data.map(vaga => {
        const linha = document.createElement('div');
        linha.className = 'meu-item';
        if (vaga.id === editandoId) linha.classList.add('editando');

        const nomeDaCidade = (cidades.find(c => c.id === vaga.cidade_id) || {}).nome || '';

        const texto = document.createElement('div');
        const titulo = document.createElement('b');
        titulo.textContent = vaga.nome;

        const detalhe = document.createElement('small');
        const partes = [
            `R$ ${vaga.preco}`,
            `${vaga.vagas} vaga${vaga.vagas > 1 ? 's' : ''}`,
            [vaga.bairro, nomeDaCidade].filter(Boolean).join(', '),
        ];
        if (vaga.status === 'em_revisao') partes.push('em revisão');
        if (vaga.status === 'recusada')   partes.push('recusada');
        if (!vaga.ativa)                  partes.push('fora do ar');
        detalhe.textContent = partes.filter(Boolean).join(' · ');

        texto.append(titulo, document.createElement('br'), detalhe);

        const acoes = document.createElement('div');
        acoes.className = 'meu-item-acoes';

        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'btn btn-linha';
        editar.textContent = vaga.id === editandoId ? 'Editando' : 'Editar';
        editar.disabled = vaga.id === editandoId;
        editar.addEventListener('click', async () => {
            // Troca o endereço sem recarregar: assim voltar no navegador
            // devolve a pessoa para onde ela estava, e recarregar a
            // página continua abrindo o anúncio certo.
            history.replaceState(null, '', `cadastrar-vaga.html?id=${vaga.id}`);
            await carregarParaEditar(vaga.id);
            carregarMinhas();
        });
        acoes.appendChild(editar);

        // Só faz sentido ver a página de uma vaga que está no ar.
        if (vaga.ativa && vaga.status === 'publicada') {
            const ver = document.createElement('a');
            ver.className = 'btn btn-linha';
            ver.href = `vaga.html?id=${vaga.id}`;
            ver.textContent = 'Ver';
            acoes.appendChild(ver);
        }

        const alternar = document.createElement('button');
        alternar.type = 'button';
        alternar.className = 'btn btn-linha';
        alternar.textContent = vaga.ativa ? 'Aluguei, tirar do ar' : 'Pôr de volta';
        alternar.addEventListener('click', async () => {
            ocupado(alternar, true, 'Um instante...');
            const { error: e } = await banco.from('republicas')
                .update({ ativa: !vaga.ativa })
                .eq('id', vaga.id);
            ocupado(alternar, false);
            if (e) return aviso('Não consegui mudar: ' + traduzirErro(e));
            carregarMinhas();
        });

        acoes.appendChild(alternar);
        linha.append(texto, acoes);
        return linha;
    }));
}


/* ---------------------------------------------------------------------
   Entrar, criar conta, sair
   --------------------------------------------------------------------- */
function abrirJanela() {
    janela.hidden = false;
    document.body.style.overflow = 'hidden';
}

function fecharJanela() {
    janela.hidden = true;
    document.body.style.overflow = '';
    recadoJanela.hidden = true;
}

janela.querySelectorAll('[data-fecha-janela]').forEach(alvo => {
    alvo.addEventListener('click', fecharJanela);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !janela.hidden) fecharJanela();
});

const formEntrar = document.getElementById('formEntrar');
const formCriar = document.getElementById('formCriar');

document.querySelectorAll('.aba').forEach(aba => {
    aba.addEventListener('click', () => {
        document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
        aba.classList.add('ativa');
        const criar = aba.dataset.aba === 'criar';
        formEntrar.hidden = criar;
        formCriar.hidden = !criar;
        recadoJanela.hidden = true;
    });
});

formEntrar.addEventListener('submit', async evento => {
    evento.preventDefault();
    recadoJanela.hidden = true;

    const botao = document.getElementById('botaoEntrar');
    ocupado(botao, true, 'Entrando...');

    const { error } = await banco.auth.signInWithPassword({
        email: document.getElementById('jEmail').value.trim(),
        password: document.getElementById('jSenha').value
    });

    ocupado(botao, false);
    if (error) return avisoNaJanela(traduzirErro(error));

    fecharJanela();
    entrar();
});

formCriar.addEventListener('submit', async evento => {
    evento.preventDefault();
    recadoJanela.hidden = true;

    const nome = document.getElementById('cNome').value.trim();
    const whatsapp = document.getElementById('cWhatsapp').value.replace(/\D/g, '');
    const email = document.getElementById('cEmail').value.trim();
    const senha = document.getElementById('cSenha').value;
    const relacao = document.getElementById('cRelacao').value;
    const aceite = document.getElementById('cAceite').checked;

    if (nome.length < 2)      return avisoNaJanela('Escreva seu nome.');
    if (whatsapp.length < 10) return avisoNaJanela('O WhatsApp precisa de DDD e número.');
    if (senha.length < 6)     return avisoNaJanela('A senha precisa de pelo menos 6 caracteres.');
    if (!relacao)             return avisoNaJanela('Diga qual é a sua relação com a casa.');
    if (!aceite)              return avisoNaJanela('Confirme que você não é corretor nem imobiliária.');

    const botao = document.getElementById('botaoCriar');
    ocupado(botao, true, 'Criando...');

    /* Os dados vão DENTRO do signUp, e não num insert depois: com a
       confirmação de e-mail ligada o cadastro termina sem sessão, e um
       insert feito pela página seria barrado pelas regras — ninguém
       está logado. O gatilho criar_perfil_do_novo_usuario, no
       04-anunciante.sql, monta o perfil a partir daqui. */
    const { data, error } = await banco.auth.signUp({
        email,
        password: senha,
        options: {
            data: {
                nome,
                telefone: whatsapp,
                relacao,
                aceitou_regras: 'true',
                cep: document.getElementById('cCep').value.replace(/\D/g, ''),
                logradouro: document.getElementById('cLogradouro').value.trim(),
                numero: document.getElementById('cNumero').value.trim(),
                complemento: '',
                bairro: document.getElementById('cBairro').value.trim(),
                cidade: document.getElementById('cCidade').value.trim(),
                uf: document.getElementById('cUf').value.trim()
            }
        }
    });

    if (error) {
        ocupado(botao, false);
        return avisoNaJanela(traduzirErro(error));
    }

    if (!data.session) {
        ocupado(botao, false);
        return avisoNaJanela('Conta criada. Confirme pelo link que enviamos no seu e-mail '
                           + 'e volte aqui para publicar a vaga.', 'certo');
    }

    ocupado(botao, false);
    fecharJanela();
    entrar();
});

// CEP do cadastro preenche o endereço DA PESSOA, usando o buscarCep().
const campoCep = document.getElementById('cCep');
campoCep.addEventListener('blur', () => buscarCep(campoCep.value, {
    logradouro: document.getElementById('cLogradouro'),
    bairro: document.getElementById('cBairro'),
    cidade: document.getElementById('cCidade'),
    uf: document.getElementById('cUf'),
    numero: document.getElementById('cNumero')
}));

const botaoSair = document.getElementById('botaoSair');
botaoSair.addEventListener('click', async () => {
    await banco.auth.signOut();
    location.reload();
});


/* ---------------------------------------------------------------------
   A porta de entrada da página
   --------------------------------------------------------------------- */
async function entrar() {
    const { data } = await banco.auth.getSession();

    verificando.hidden = true;
    tela.hidden = false;

    if (!data.session) {
        // Sem conta a pessoa vê a página inteira e o pop-up por cima:
        // ela entende o que vai preencher antes de decidir se cadastra.
        abrirJanela();
        return;
    }

    usuario = data.session.user;
    botaoSair.hidden = false;

    await carregarCidades();
    await preencherDoPerfil();
    await carregarLimite();

    if (editandoId) await carregarParaEditar(editandoId);

    carregarMinhas();
}

/* O WhatsApp do cadastro já vem preenchido: quem acabou de digitar o
   número não deve digitar de novo três campos abaixo. */
async function preencherDoPerfil() {
    const { data } = await banco.from('perfis')
        .select('telefone').eq('id', usuario.id).maybeSingle();

    const campo = document.getElementById('whatsapp');
    if (data && data.telefone && !campo.value) {
        campo.value = mascararTelefone(data.telefone);
    }
}

/* A volta leva a cidade junto: quem veio anunciar em Varginha não deve
   voltar para uma busca sem cidade escolhida. */
const cidadeDaURL = new URLSearchParams(location.search).get('cidade');
document.getElementById('voltarBusca').href =
    cidadeDaURL ? `index.html?cidade=${cidadeDaURL}#republicas` : 'index.html#cidade';

if (!banco) {
    verificando.textContent =
        'O site ainda não está ligado ao banco. Confira o js/supabase-config.js.';
} else {
    entrar();
}


/* ---------------------------------------------------------------------
   O teto da conta

   Um anúncio no ar por conta. Quem tem duas repúblicas de verdade fala
   com o administrador e ganha o teto maior — é a mesma ideia do
   Comércio Alfenas: não dá para detectar um corretor, mas dá para
   encarecer o volume. Dono de uma casa nunca esbarra nisto.

   Editar não conta: mexer no anúncio que já está no ar continua livre,
   senão a pessoa no limite ficaria sem poder corrigir o próprio preço.
   --------------------------------------------------------------------- */
const avisoLimite = document.getElementById('avisoLimite');

function conferirLimite(ativos) {
    const estourou = !editandoId && ativos >= limiteDaConta;

    avisoLimite.hidden = !estourou;
    travarFormulario(estourou);

    // O pedido já vai escrito: quem está pedindo liberação não deve ter
    // que explicar do zero quem é nem o que quer.
    const pedido = document.getElementById('pedirLiberacao');
    if (estourou && usuario) {
        const texto = 'Olá! Sou anunciante no Achei República (' + usuario.email
            + ') e tenho mais de uma república. Posso anunciar a segunda?';
        pedido.href = 'https://wa.me/5531999347032?text=' + encodeURIComponent(texto);
    }
}

/* Trava o formulário inteiro, e não só o botão.

   O botão sozinho não basta por dois motivos. O primeiro é honesto:
   quem não leu a faixa preenche trinta campos e sobe cinco fotos para
   descobrir no fim que não podia — e a culpa disso o site leva sozinho.
   O segundo é o outro: campo aberto convida a tentar burlar.

   Nada disso é a barreira de verdade. Quem quiser passar por cima da
   tela consegue, porque a chave pública está no código-fonte. Quem
   recusa mesmo é o gatilho do 10-um-anuncio-por-conta.sql, no banco.
   Isto aqui é para a pessoa honesta não perder a tarde. */
function travarFormulario(travado) {
    form.querySelectorAll('input, select, textarea, button').forEach(campo => {
        campo.disabled = travado;
    });

    form.classList.toggle('travado', travado);

    botaoPublicar.title = travado
        ? 'Sua conta já tem anúncio no ar. Tire um do ar ou peça liberação.'
        : '';
}

/* O teto vem do perfil. Se a leitura falhar, fica em 1 — errar para o
   lado apertado só faz a pessoa falar com você; errar para o lado
   frouxo deixa passar o que a regra existe para barrar. */
async function carregarLimite() {
    const { data } = await banco.from('perfis')
        .select('limite_anuncios').eq('id', usuario.id).maybeSingle();

    limiteDaConta = (data && data.limite_anuncios) ? data.limite_anuncios : 1;
}
