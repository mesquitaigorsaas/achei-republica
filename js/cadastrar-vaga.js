/* =====================================================================
   Achei República — cadastrar a vaga

   A ponta que faltava. Quem tem quarto vago publica aqui, e o anúncio
   aparece na vitrine da home da cidade dele.

   É uma página diferente do anunciar.html de propósito. Quem está se
   desfazendo de uma geladeira e quem está oferecendo um lugar para
   morar não respondem às mesmas perguntas: a geladeira quer foto e
   preço; a casa quer quantos minutos até a faculdade, o jeito da casa,
   os cursos de quem mora e cinquenta características que viram filtro.
   Um formulário só para as duas coisas seria longo demais para a
   geladeira e raso demais para a casa.

   O banco, a máscara de telefone, a busca de CEP e o ocupado() vêm do
   js/conta.js, carregado antes deste. O vocabulário (TIPOS, PERFIS,
   MODOS, MARCAS) vem do js/marcas.js. Não recriar nada disso aqui: os
   dois já declaram no escopo global, e um segundo const com o mesmo
   nome quebra a página inteira.
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
let escolhidas = [];
let cidades = [];


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
    return erro && erro.message ? erro.message : 'Não deu certo. Tente de novo.';
}


/* ---------------------------------------------------------------------
   As escolhas de botão, montadas pelo vocabulário

   Tipo e perfil são colunas com check constraint no banco. Escrever as
   opções à mão no HTML deixaria dois lugares para errar; saindo daqui,
   o apelido gravado é sempre um dos que o banco aceita.
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

montarEscolhas(document.getElementById('escolhaTipo'), TIPOS, valor => {
    tipo = valor;
    // O resto do formulário só abre depois da primeira escolha: um
    // formulário deste tamanho aberto de cara é uma parede.
    resto.hidden = false;
    limparRecados();
});

montarEscolhas(document.getElementById('escolhaPerfil'), PERFIS, valor => {
    perfil = valor;
}, 'mista');

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
   do id da cidade, e id é coisa que só o banco sabe. É também o único
   lugar do site que lê a tabela cidades — as duas listas concordarem é
   responsabilidade do 03-dados-iniciais.sql, que semeou as catorze.
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

async function carregarFaculdades() {
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

    dicaFaculdade.textContent =
        'Metade da nota de compatibilidade sai daqui. Quem sabe o caminho é você.';
}

selCidade.addEventListener('change', carregarFaculdades);


/* ---------------------------------------------------------------------
   As fotos — até cinco
   --------------------------------------------------------------------- */
entradaFotos.addEventListener('change', () => {
    limparRecados();
    const novas = [...entradaFotos.files];

    if (escolhidas.length + novas.length > MAX_FOTOS) {
        aviso(`São no máximo ${MAX_FOTOS} fotos. Peguei as primeiras que couberam.`, 'certo');
    }

    escolhidas = [...escolhidas, ...novas].slice(0, MAX_FOTOS);

    // O input é zerado para a pessoa poder escolher o mesmo arquivo de
    // novo depois de tirá-lo da lista — sem isso o "change" não dispara.
    entradaFotos.value = '';
    desenharPrevia();
});

function desenharPrevia() {
    previaFotos.replaceChildren(...escolhidas.map((arquivo, i) => {
        const moldura = document.createElement('div');
        moldura.className = 'previa-item';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(arquivo);
        img.alt = `Foto ${i + 1}`;
        // Solta a memória do arquivo assim que o navegador desenhou.
        img.onload = () => URL.revokeObjectURL(img.src);

        const tirar = document.createElement('button');
        tirar.type = 'button';
        tirar.className = 'previa-x';
        tirar.setAttribute('aria-label', `Tirar a foto ${i + 1}`);
        tirar.textContent = '×';
        tirar.addEventListener('click', () => {
            escolhidas.splice(i, 1);
            desenharPrevia();
        });

        // A primeira é a que aparece no cartão da busca. Dizer isso
        // evita a pessoa subir a foto do banheiro em primeiro lugar.
        if (i === 0) {
            const selo = document.createElement('span');
            selo.className = 'previa-selo';
            selo.textContent = 'Capa';
            moldura.appendChild(selo);
        }

        moldura.append(img, tirar);
        return moldura;
    }));
}


/* ---------------------------------------------------------------------
   Publicar
   --------------------------------------------------------------------- */
form.addEventListener('submit', async evento => {
    evento.preventDefault();
    limparRecados();

    const nome = document.getElementById('nome').value.trim();
    const bairro = document.getElementById('bairro').value.trim();
    const preco = Number(document.getElementById('preco').value) || 0;
    const caucao = Number(document.getElementById('caucao').value) || 0;
    const vagas = Number(document.getElementById('vagas').value) || 1;
    const minutos = Number(document.getElementById('minutos').value) || null;
    const disponivel = document.getElementById('disponivel').value || null;
    const descricao = document.getElementById('descricao').value.trim() || null;
    const whatsapp = document.getElementById('whatsapp').value.replace(/\D/g, '');
    const faculdadeId = selFaculdade.hidden ? null : (selFaculdade.value || null);

    if (!tipo)             return aviso('Escolha o que você está oferecendo.');
    if (nome.length < 2)   return aviso('Escreva o nome da casa.');
    if (!bairro)           return aviso('Escreva o bairro — é o que a pessoa procura primeiro.');
    if (preco <= 0)        return aviso('Escreva o valor do aluguel.');
    if (whatsapp.length < 10) return aviso('O WhatsApp precisa de DDD e número.');

    ocupado(botaoPublicar, true, 'Publicando...');

    const { data: vaga, error } = await banco.from('republicas').insert({
        dono_id: usuario.id,
        cidade_id: selCidade.value,
        faculdade_id: faculdadeId,
        nome,
        bairro,
        descricao,
        tipo,
        perfil,
        preco,
        caucao,
        minutos,
        modo: selModo.value,
        vagas,
        disponivel_em: disponivel,
        whatsapp
    }).select('id, status').single();

    if (error) {
        ocupado(botaoPublicar, false);
        console.error('Falhou ao publicar a vaga:', error);
        return aviso('Não consegui publicar: ' + error.message);
    }

    /* As tabelas filhas vão depois, e cada uma pode falhar sozinha. Um
       erro aqui NÃO derruba o anúncio — ele já está no ar, e uma casa
       no ar sem a etiqueta "aceita pet" é melhor que casa nenhuma. O
       que não pode é a pessoa achar que gravou o que não gravou, então
       cada falha entra no aviso do fim. */
    const falhas = [];

    const marcas = marcasEscolhidas();
    if (marcas.length) {
        const { error: e } = await banco.from('republica_marcas')
            .insert(marcas.map(marca => ({ republica_id: vaga.id, marca })));
        if (e) falhas.push('as características');
    }

    const cursos = document.getElementById('cursos').value
        .split(',').map(c => c.trim()).filter(Boolean);
    if (cursos.length) {
        const { error: e } = await banco.from('republica_cursos')
            .insert(cursos.map(curso => ({ republica_id: vaga.id, curso })));
        if (e) falhas.push('os cursos');
    }

    // Uma foto de cada vez, e não as cinco juntas: são fotos de celular
    // de vários MB, e cinco subindo em paralelo numa internet de cidade
    // pequena travam as cinco.
    let fotosQueSubiram = 0;
    for (let i = 0; i < escolhidas.length; i++) {
        const caminho = await subirFoto(escolhidas[i], vaga.id);
        if (!caminho) continue;

        const { error: e } = await banco.from('republica_fotos')
            .insert({ republica_id: vaga.id, caminho, ordem: i });
        if (!e) fotosQueSubiram++;
    }
    if (fotosQueSubiram < escolhidas.length) falhas.push('parte das fotos');

    ocupado(botaoPublicar, false);
    form.reset();
    escolhidas = [];
    desenharPrevia();
    caixaMarcas.querySelectorAll('input[data-marca]').forEach(c => { c.checked = false; });
    tipo = '';
    resto.hidden = true;
    document.querySelectorAll('#escolhaTipo .escolha').forEach(b => b.classList.remove('ativa'));

    /* A triagem do 04-anunciante.sql pode ter mandado o anúncio para a
       fila — do terceiro anúncio em diante, ou quando o texto tem cara
       de imobiliária. Dizer isso é obrigação: o dono vai procurar a
       casa na busca e não vai achar, e sem explicação isso parece bug. */
    let recado = vaga.status === 'em_revisao'
        ? 'Vaga cadastrada e em revisão. Ela ainda não aparece na busca — '
          + 'a gente olha e libera. Isso acontece a partir do terceiro anúncio.'
        : 'Vaga no ar. Quem procurar república nessa cidade já vai ver a sua.';

    if (falhas.length) recado += ' Só não consegui gravar ' + falhas.join(' e ') + '.';

    aviso(recado, 'certo');
    carregarMinhas();
});


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

    listaMinhas.replaceChildren(...data.map(vaga => {
        const linha = document.createElement('div');
        linha.className = 'meu-item';

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
            if (e) return aviso('Não consegui mudar: ' + e.message);
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

// CEP preenche o endereço, usando o buscarCep() do conta.js.
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
