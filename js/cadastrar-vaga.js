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

/* O plano que a pessoa escolheu no painel da home, se ela veio de lá.
   O destaque se contrata PARA UMA VAGA, e na home ela ainda não tinha
   nenhuma — então a escolha viaja no endereço e só é cobrada aqui no
   fim, quando a vaga existe. Nada aqui decide preço: isto é só a
   lembrança de um clique. */
const planoEscolhido = (new URLSearchParams(location.search).get('plano') || '').trim();


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
    // Do gatilho do 18-varias-faculdades.sql. Não deveria chegar aqui —
    // a tela já não deixa passar de três —, mas o banco é quem manda, e
    // erro do banco em inglês na cara de quem anuncia é o pior desfecho.
    if (m.includes('limite_de_faculdades')) {
        return 'Uma vaga pode indicar no máximo três faculdades. Tire uma para pôr outra.';
    }
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

/* =====================================================================
   ATÉ TRÊS FACULDADES, CADA UMA COM O SEU TEMPO

   Uma casa no Coração Eucarístico está perto da PUC CE e do CEFET Nova
   Suíça. Obrigar o anunciante a escolher uma joga fora metade dos
   estudantes que a casa serve — e em Alfenas isso nunca apareceu porque
   lá faculdade e lugar eram a mesma coisa.

   O TETO É TRÊS, e não é economia de tela: quem marca oito está dizendo
   "estou perto de tudo", que é o mesmo que não dizer nada, e vira o
   jeito mais barato de aparecer em toda busca sem pagar destaque. O
   banco também recusa a quarta, pelo gatilho do 18-varias-faculdades.
   ===================================================================== */
const MAX_FACULDADES = 3;

const listaFaculdades = document.getElementById('faculdadesEscolhidas');
const botaoMaisFaculdade = document.getElementById('maisFaculdade');

// As faculdades da cidade escolhida: [{ id, nome, sigla }]
let faculdadesDaCidade = [];

function linhasDeFaculdade() {
    return [...listaFaculdades.querySelectorAll('.faculdade-linha')];
}

/* O que está escolhido agora, sem repetição e sem linha em branco. */
function faculdadesEscolhidas() {
    const vistas = new Set();

    return linhasDeFaculdade().map(linha => {
        const id = linha.querySelector('.rf-faculdade').value;
        const min = linha.querySelector('.rf-minutos').value;
        return { faculdade_id: id, minutos: min === '' ? null : Number(min) };
    }).filter(f => {
        if (!f.faculdade_id || vistas.has(f.faculdade_id)) return false;
        vistas.add(f.faculdade_id);
        return true;
    });
}

function montarLinha(escolhida, minutos) {
    const linha = document.createElement('div');
    linha.className = 'faculdade-linha';

    const campoFac = document.createElement('div');
    campoFac.className = 'campo';

    const sel = document.createElement('select');
    sel.className = 'rf-faculdade';
    sel.setAttribute('aria-label', 'Faculdade perto da casa');

    const vazia = document.createElement('option');
    vazia.value = '';
    vazia.textContent = 'Escolha a faculdade';
    sel.appendChild(vazia);

    faculdadesDaCidade.forEach(f => {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = `${f.sigla} — ${f.nome}`;
        sel.appendChild(o);
    });

    if (escolhida && faculdadesDaCidade.some(f => f.id === escolhida)) sel.value = escolhida;
    campoFac.appendChild(sel);

    const campoMin = document.createElement('div');
    campoMin.className = 'campo campo-minutos';

    const min = document.createElement('input');
    min.type = 'number';
    min.className = 'rf-minutos';
    min.min = '1';
    min.max = '240';
    min.step = '1';
    min.placeholder = 'min';
    min.setAttribute('aria-label', 'Minutos até esta faculdade');
    if (minutos !== null && minutos !== undefined) min.value = minutos;
    campoMin.appendChild(min);

    /* A primeira linha não tem "tirar": deixar a pessoa esvaziar tudo e
       ficar olhando um bloco sem nada é pior do que ela simplesmente não
       escolher faculdade nenhuma no seletor. */
    const tirar = document.createElement('button');
    tirar.type = 'button';
    tirar.className = 'tirar-faculdade';
    tirar.textContent = '✕';
    tirar.setAttribute('aria-label', 'Tirar esta faculdade');
    tirar.addEventListener('click', () => {
        linha.remove();
        arrumarBotaoMais();
    });

    linha.append(campoFac, campoMin, tirar);
    return linha;
}

function arrumarBotaoMais() {
    const quantas = linhasDeFaculdade().length;

    botaoMaisFaculdade.hidden = !faculdadesDaCidade.length || quantas >= MAX_FACULDADES;

    // O ✕ só aparece a partir da segunda linha.
    linhasDeFaculdade().forEach((linha, i) => {
        linha.querySelector('.tirar-faculdade').hidden = i === 0;
    });
}

botaoMaisFaculdade.addEventListener('click', () => {
    if (linhasDeFaculdade().length >= MAX_FACULDADES) return;
    listaFaculdades.appendChild(montarLinha());
    arrumarBotaoMais();
});


/* Recarrega as faculdades da cidade e redesenha as linhas.

   "manter" é a lista que veio do banco na edição:
   [{ faculdade_id, minutos }]. Sem ela, começa com uma linha vazia. */
async function carregarFaculdades(manter) {
    const { data } = await banco
        .from('faculdades')
        .select('id, nome, sigla')
        .eq('cidade_id', selCidade.value)
        .order('sigla');

    faculdadesDaCidade = data || [];
    listaFaculdades.replaceChildren();

    // Cidade sem faculdade cadastrada: o bloco some em vez de virar um
    // seletor vazio que a pessoa abre e fecha sem entender.
    if (!faculdadesDaCidade.length) {
        botaoMaisFaculdade.hidden = true;
        dicaFaculdade.textContent =
            'Ainda não temos faculdade cadastrada nesta cidade — pode deixar em branco.';
        return;
    }

    const guardadas = (manter || []).slice(0, MAX_FACULDADES);

    if (guardadas.length) {
        guardadas.forEach(g => listaFaculdades.appendChild(
            montarLinha(g.faculdade_id, g.minutos)));
    } else {
        listaFaculdades.appendChild(montarLinha());
    }

    arrumarBotaoMais();

    dicaFaculdade.textContent =
        'Metade da nota de compatibilidade sai daqui. Marque só as que a casa '
      + 'realmente serve — dizer que está perto de tudo faz o estudante '
      + 'desconfiar da lista inteira.';
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

    /* Sessão que expirou enquanto a pessoa preenchia. Sem esta linha,
       enviar estouraria num "usuario is null" e a página não faria
       nada -- o pior desfecho para quem acabou de digitar tudo. */
    if (!usuario) {
        mandarParaOLogin();
        return;
    }

    const campos = {
        cidade_id: selCidade.value,
        /* A PRIMEIRA das faculdades escolhidas continua sendo gravada
           aqui, na coluna antiga, junto com o tempo dela lá embaixo.

           Não é redundância esquecida: o site no ar ainda lê estas duas
           colunas, e apagá-las agora derrubaria a vitrine no segundo em
           que este código subisse. Elas saem num arquivo próprio, depois
           que a leitura pela tabela nova estiver publicada — a ordem
           está escrita no fim do 18-varias-faculdades.sql. */
        faculdade_id: (faculdadesEscolhidas()[0] || {}).faculdade_id || null,
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
        minutos: (faculdadesEscolhidas()[0] || {}).minutos ?? null,
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
        if (seguirParaODestaque(vaga)) return;
    }

    carregarMinhas();
});


/* ---------------------------------------------------------------------
   Ela veio da home escolhendo um plano pago

   A vaga acabou de nascer, então agora existe a que destacar. Leva para
   o pagamento com o plano e a vaga já escolhidos — a pessoa não repete
   nada do que já decidiu lá atrás.

   Duas saídas que NÃO levam ao pagamento, e as duas de propósito:

   - anúncio em revisão: a cobrança recusa vaga não publicada, e está
     certa. Vender evidência para um anúncio que não está sendo mostrado
     é vender o que não existe. Aqui a pessoa fica sabendo disso em vez
     de bater num erro do outro lado.
   - plano gratuito ou lixo no endereço: não há o que cobrar.

   Devolve true quando assumiu a navegação, para quem chamou parar.
   --------------------------------------------------------------------- */
function seguirParaODestaque(vaga) {
    if (!planoEscolhido || planoEscolhido === 'gratuito') return false;

    if (vaga.status !== 'publicada') {
        aviso('Salvo, e em revisão. O destaque ' + planoEscolhido + ' fica guardado para '
            + 'quando o anúncio for liberado — a gente não cobra por um anúncio '
            + 'que ainda não está aparecendo.', 'certo');
        return false;
    }

    aviso('Vaga no ar. Levando você para o pagamento do destaque...', 'certo');

    setTimeout(() => {
        location.href = 'planos.html?vaga=' + encodeURIComponent(vaga.id)
                      + '&plano=' + encodeURIComponent(planoEscolhido);
    }, 1200);

    return true;
}


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
        await banco.from('republica_faculdades').delete().eq('republica_id', vagaId);
    }

    /* As faculdades da vaga. Reescritas por inteiro na edição, como as
       marcas — são três linhas, e comparar o que mudou daria o mesmo
       resultado com três vezes mais código.

       O apagar vem antes de qualquer insert, e não junto: o gatilho do
       banco recusa a quarta linha, e sem limpar antes uma edição que
       troca as três faculdades esbarraria no próprio teto. */
    const faculdades = faculdadesEscolhidas();
    if (faculdades.length) {
        const { error } = await banco.from('republica_faculdades')
            .insert(faculdades.map(f => ({ republica_id: vagaId, ...f })));
        if (error) falhas.push('as faculdades');
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

    /* O form.reset() zera os campos, mas não tira as linhas de faculdade
       acrescentadas — elas são DOM criado na hora, e o reset não conhece.
       Sem isto, o próximo anúncio nasceria com as três faculdades do
       anterior já na tela, e a pessoa salvaria as do vizinho sem
       perceber. */
    listaFaculdades.replaceChildren();
    if (faculdadesDaCidade.length) listaFaculdades.appendChild(montarLinha());
    arrumarBotaoMais();

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
    por('disponivel', data.disponivel_em);
    por('whatsapp', data.whatsapp ? mascararTelefone(data.whatsapp) : '');

    selCidade.value = data.cidade_id;
    /* As faculdades vêm da tabela própria, e não do data.faculdade_id.

       Aquela coluna ainda existe, mas guarda só a PRIMEIRA das três —
       carregar por ela perderia a segunda e a terceira ao abrir para
       editar, e a pessoa salvaria por cima achando que não tinha mexido
       em nada. É o tipo de perda que ninguém percebe na hora. */
    const { data: faculdadesDaVaga } = await banco
        .from('republica_faculdades')
        .select('faculdade_id, minutos')
        .eq('republica_id', id);

    await carregarFaculdades(faculdadesDaVaga || []);
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
/* A promoção mais recente de cada vaga, e os números dela. Buscados
   uma vez por carregamento da lista, e não um por linha: com o limite
   de anúncios por conta são poucas vagas, mas uma consulta dentro do
   laço vira lentidão na hora em que alguém for liberado para dez. */
let promocaoDaVaga = {};
let numerosDaVaga = {};

async function carregarPromocoes(ids) {
    promocaoDaVaga = {};
    numerosDaVaga = {};
    if (!ids.length) return;

    const { data } = await banco
        .from('promocoes')
        .select('id, republica_id, plano, status, preco_centavos, comeca_em, termina_em, criada_em')
        .in('republica_id', ids)
        .order('criada_em', { ascending: false });

    // A primeira de cada vaga é a mais recente, porque a consulta já
    // veio ordenada. Uma ativa vence uma antiga encerrada.
    (data || []).forEach(promo => {
        const atual = promocaoDaVaga[promo.republica_id];
        if (!atual || (promo.status === 'ativa' && atual.status !== 'ativa')) {
            promocaoDaVaga[promo.republica_id] = promo;
        }
    });

    /* Os números. Em paralelo, e com falha tolerada: se o resumo não
       vier, a linha da vaga aparece sem as estatísticas — e não some. */
    await Promise.all(ids.map(async id => {
        try {
            const { data: linhas } = await banco.rpc('resumo_da_vaga', { alvo: id });
            numerosDaVaga[id] = linhas || [];
        } catch (e) {
            console.debug('Resumo não carregado para', id, e);
        }
    }));
}

/* Soma o resumo devolvido pelo banco, que vem quebrado por janela, tipo
   e origem. Aqui vira o par de números que a pessoa lê sem pensar. */
function somar(linhas, janela, tipo, origem) {
    return (linhas || [])
        .filter(l => l.janela === janela && l.tipo === tipo
                     && (!origem || l.origem === origem))
        .reduce((total, l) => total + Number(l.quantas || 0), 0);
}

async function carregarMinhas() {
    /* As colunas do destaque podem ainda não existir: o site sobe pelo
       GitHub Pages e o banco muda pelo SQL Editor, nunca juntos. Pedir
       coluna inexistente derruba a consulta inteira no PostgREST — e
       aqui isso apagaria a lista de vagas da pessoa, que é a parte da
       página que ela mais precisa. */
    const buscar = campos => banco
        .from('republicas')
        .select(campos)
        .eq('dono_id', usuario.id)
        .order('criada_em', { ascending: false });

    const base = 'id, nome, bairro, preco, vagas, ativa, status, cidade_id';

    let { data, error } = await buscar(base + ', destaque, destaque_ate');

    if (error && (error.code === '42703' || /destaque/.test(error.message || ''))) {
        console.warn('Banco ainda sem as colunas de destaque; seguindo sem elas.');
        ({ data, error } = await buscar(base));
    }

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

    await carregarPromocoes(data.map(v => v.id));

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
        texto.appendChild(faixaDoDestaque(vaga));

        const numeros = faixaDeNumeros(vaga);
        if (numeros) texto.appendChild(numeros);

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

        /* O botão de destacar.

           Não aparece para anúncio em revisão nem para anúncio fora do
           ar: nos dois casos ele levaria a pessoa a pagar por
           visibilidade que a vaga não tem. É a mesma regra do botão
           "Falar" sem telefone — caminho que não funciona não se
           oferece, mesmo quando oferecer daria dinheiro.

           E não aparece quando já há destaque valendo: um por vez. */
        const jaDestacada = destaqueValendo(vaga);
        if (vaga.ativa && vaga.status === 'publicada' && !jaDestacada) {
            const promo = promocaoDaVaga[vaga.id];
            const jaTeve = promo && ['expirada', 'ativa'].includes(promo.status);

            const destacar = document.createElement('a');
            destacar.className = 'btn btn-linha btn-destacar';
            destacar.href = `planos.html?vaga=${vaga.id}`;
            destacar.textContent = jaTeve ? 'Destacar de novo' : 'Destacar vaga';
            acoes.appendChild(destacar);
        }

        linha.append(texto, acoes);
        return linha;
    }));
}


/* ---------------------------------------------------------------------
   A faixa de situação da vaga

   Uma linha, sempre presente, dizendo em que pé está o anúncio:

     Vaga gratuita
     ⭐ Destaque · 23 dias restantes · até 06/10/2026
     Pagamento em análise
     Destaque pausado enquanto a vaga está fora do ar
     Seu destaque terminou. Sua vaga continua ativa gratuitamente.

   "Gratuita" aparece com todas as letras, e não como ausência de
   selo. Quem anuncia de graça não está num limbo: está num plano, com
   nome, que funciona. Deixar a linha vazia faria parecer que falta
   fazer alguma coisa.
   --------------------------------------------------------------------- */
function faixaDoDestaque(vaga) {
    const faixa = document.createElement('small');
    faixa.className = 'meu-item-plano';

    const promo = promocaoDaVaga[vaga.id];
    const plano = destaqueValendo(vaga);

    if (plano) {
        faixa.classList.add('plano-' + plano);
        faixa.textContent =
            `${SELO_DO_PLANO[plano]} ${NOME_DO_PLANO[plano]} · `
            + `${frasedeDiasRestantes(vaga.destaque_ate)} · `
            + `até ${dataCurtaBR(vaga.destaque_ate)}`;
        return faixa;
    }

    if (promo && promo.status === 'aguardando') {
        faixa.classList.add('plano-aguardando');
        faixa.textContent = 'Pagamento em análise. O destaque acende sozinho assim que for '
            + 'confirmado — não precisa pagar de novo.';
        return faixa;
    }

    /* Promoção ativa numa vaga fora do ar: o destaque está pausado, e
       não perdido. Dizer isso importa — a pessoa acabou de tirar do ar
       achando que alugou, e a primeira coisa que passa pela cabeça é
       "perdi os R$ 39,90". */
    if (promo && promo.status === 'ativa' && !vaga.ativa
        && new Date(promo.termina_em).getTime() > Date.now()) {
        faixa.classList.add('plano-pausado');
        faixa.textContent =
            `${SELO_DO_PLANO[promo.plano] || ''} ${NOME_DO_PLANO[promo.plano]} pausado: `
            + `a vaga está fora do ar. Pondo de volta, o destaque volta com ela, `
            + `até ${dataCurtaBR(promo.termina_em)}.`;
        return faixa;
    }

    if (promo && promo.status === 'expirada') {
        faixa.classList.add('plano-terminado');
        faixa.textContent = 'Seu destaque terminou. Sua vaga continua ativa gratuitamente.';
        return faixa;
    }

    if (promo && promo.status === 'recusada') {
        faixa.classList.add('plano-aguardando');
        faixa.textContent = 'O último pagamento não foi aprovado. Nada foi cobrado.';
        return faixa;
    }

    faixa.textContent = 'Vaga gratuita · aparece nas buscas e nos filtros';
    return faixa;
}


/* ---------------------------------------------------------------------
   Os números

   Aparece só quando há o que mostrar. Zero visita num anúncio de
   ontem não é informação — é desânimo sem motivo.

   O que o plano muda aqui é o DETALHE, e não o acesso: os números são
   do anunciante, e cobrar para ele ver o que é dele seria feio. O
   grátis vê o total; quem pagou vê de onde as pessoas vieram, que é o
   que responde se vale destacar de novo.
   --------------------------------------------------------------------- */
function faixaDeNumeros(vaga) {
    const linhas = numerosDaVaga[vaga.id];
    if (!linhas || !linhas.length) return null;

    const apareceu = somar(linhas, 'sempre', 'vitrine');
    const visitas  = somar(linhas, 'sempre', 'visita');
    const contatos = somar(linhas, 'sempre', 'contato');

    if (!apareceu && !visitas && !contatos) return null;

    const caixa = document.createElement('small');
    caixa.className = 'meu-item-numeros';

    const partes = [
        `${apareceu} ${apareceu === 1 ? 'aparição' : 'aparições'} nas buscas`,
        `${visitas} ${visitas === 1 ? 'visita' : 'visitas'} ao anúncio`,
        `${contatos} no WhatsApp`,
    ];

    const plano = destaqueValendo(vaga);
    if (plano === 'premium' || plano === 'pro') {
        const porFiltro = somar(linhas, 'sempre', 'visita', 'filtro');
        const porMatch  = somar(linhas, 'sempre', 'visita', 'match');
        partes.push(`${porFiltro} chegaram pelos filtros`);
        if (porMatch) partes.push(`${porMatch} pelo questionário`);

        const naPromocao = somar(linhas, 'na_promocao', 'contato');
        if (naPromocao) partes.push(`${naPromocao} contatos durante o destaque`);
    }

    caixa.textContent = partes.join(' · ');
    return caixa;
}


/* ---------------------------------------------------------------------
   Entrar, criar conta, sair
   --------------------------------------------------------------------- */
/* UMA PORTA DE ENTRADA SÓ

   Esta página tinha o próprio formulário de login, num pop-up por cima
   do conteúdo. Dois problemas, e o segundo é o grave:

   - a caixa era mais alta que a tela num notebook, e o título dela
     ficava cortado atrás do cabeçalho;
   - quem clicava em "Sair" era recebido por ela imediatamente, porque a
     página, deslogada, exige login. O efeito era um laço: sair não
     levava a lugar nenhum, e parecia que o botão não funcionava.

   Agora quem não está logado vai para a página de login — a mesma para
   o site inteiro, onde já se pergunta se a pessoa veio cuidar da vaga
   ou dos classificados.

   replace() e não href: a página que exige login não deve ficar no
   histórico. Sem isso, o "voltar" do navegador, depois de entrar,
   devolveria a pessoa para a tela que a mandou embora. */
function mandarParaOLogin() {
    location.replace('auth/login.html?destino=%2Fcadastrar-vaga.html');
}

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
    /* Para a home, e não recarregar: esta página exige login, então
       recarregá-la deslogado devolvia a pessoa para o login. Sair tem
       de terminar em algum lugar onde dê para ficar. */
    location.replace('index.html');
});


/* ---------------------------------------------------------------------
   A porta de entrada da página
   --------------------------------------------------------------------- */
async function entrar() {
    const { data } = await banco.auth.getSession();

    verificando.hidden = true;
    tela.hidden = false;

    if (!data.session) {
        mandarParaOLogin();
        return;
    }

    usuario = data.session.user;
    botaoSair.hidden = false;

    await carregarCidades();
    await preencherDoPerfil();
    await carregarLimite();

    if (editandoId) await carregarParaEditar(editandoId);

    await carregarMinhas();
    conferirVoltaDoPagamento();
}


/* ---------------------------------------------------------------------
   A volta do Mercado Pago

   Quem paga é mandado de volta para cá com ?pagamento=aprovado. Só que
   "aprovado" ali é o navegador falando: quem acende o destaque é a
   notificação que chega do Mercado Pago no servidor, e ela pode levar
   alguns segundos — no Pix, quase sempre menos de cinco.

   Isso cria uma janela pequena e desagradável: a pessoa pagou, voltou,
   e a lista ainda diz "vaga gratuita". Sem explicação, ela paga de
   novo.

   Então a página diz o que está acontecendo e volta a olhar sozinha,
   duas vezes. Se em quinze segundos não acendeu, o recado muda de tom
   sem assustar: está registrado, ninguém precisa pagar outra vez.
   --------------------------------------------------------------------- */
function conferirVoltaDoPagamento() {
    const situacao = new URLSearchParams(location.search).get('pagamento');
    if (!situacao) return;

    // Some da URL: recarregar a página depois não deve reabrir o aviso.
    const limpa = new URL(location.href);
    limpa.searchParams.delete('pagamento');
    history.replaceState(null, '', limpa);

    if (situacao === 'falhou') {
        return aviso('O pagamento não foi concluído, e nada foi cobrado. '
            + 'Sua vaga continua no ar gratuitamente.');
    }

    if (situacao === 'pendente') {
        return aviso('Pagamento em análise. Assim que for confirmado, o destaque '
            + 'acende sozinho — não precisa pagar de novo.', 'certo');
    }

    aviso('Pagamento recebido. O destaque acende em alguns segundos.', 'certo');

    let tentativas = 0;
    const olhar = setInterval(async () => {
        tentativas++;
        await carregarMinhas();

        const acendeu = Object.values(promocaoDaVaga).some(p => p.status === 'ativa');
        if (acendeu) {
            clearInterval(olhar);
            aviso('Pronto: sua vaga está destacada.', 'certo');
        } else if (tentativas >= 3) {
            clearInterval(olhar);
            aviso('Seu pagamento está registrado e o destaque acende assim que o '
                + 'Mercado Pago confirmar. Não pague de novo — se em uma hora não '
                + 'tiver acendido, fale com a gente.', 'certo');
        }
    }, 5000);
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
        pedido.href = 'https://wa.me/5531983036983?text=' + encodeURIComponent(texto);
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
