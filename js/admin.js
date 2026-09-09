/* =====================================================================
   Achei República — a administração

   Três listas e alguns botões. A fila de revisão, as denúncias e os
   anunciantes.

   Quem manda aqui NÃO é esta página: é a coluna "admin" do perfil e as
   regras do 11-painel-do-administrador.sql. Se alguém apagar o "hidden"
   do painel pelo inspetor do navegador, vai ver três listas vazias —
   as funções do banco conferem sou_admin() antes de devolver qualquer
   linha, e as regras de escrita recusam do mesmo jeito. Esconder a tela
   é conforto, não barreira.

   O banco e o ocupado() vêm do js/conta.js, carregado antes deste.
   ===================================================================== */

const verificando = document.getElementById('verificando');
const telaEntrar = document.getElementById('telaEntrar');
const telaNegado = document.getElementById('telaNegado');
const painel = document.getElementById('painel');
const recadoCaixa = document.getElementById('recado');
const recadoEntrar = document.getElementById('recadoEntrar');

let usuario = null;


/* ---------------------------------------------------------------------
   Recados
   --------------------------------------------------------------------- */
function mostrar(caixa, texto, tipo) {
    caixa.textContent = texto;
    caixa.className = 'recado recado-' + (tipo === 'certo' ? 'certo' : 'erro');
    caixa.hidden = false;
}

const aviso = (t, tipo) => mostrar(recadoCaixa, t, tipo);

function traduzirErro(erro) {
    const m = (erro && erro.message ? erro.message : '').toLowerCase();
    if (m.includes('invalid login')) return 'E-mail ou senha não conferem.';
    if (m.includes('email not confirmed')) return 'Falta confirmar o e-mail dessa conta.';
    return erro && erro.message ? erro.message : 'Não deu certo. Tente de novo.';
}


/* ---------------------------------------------------------------------
   Entrar
   --------------------------------------------------------------------- */
document.getElementById('formEntrar').addEventListener('submit', async evento => {
    evento.preventDefault();
    recadoEntrar.hidden = true;

    const botao = document.getElementById('botaoEntrar');
    ocupado(botao, true, 'Entrando...');

    const { error } = await banco.auth.signInWithPassword({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('senha').value
    });

    ocupado(botao, false);
    if (error) return mostrar(recadoEntrar, traduzirErro(error));

    abrir();
});

async function sair() {
    await banco.auth.signOut();
    location.reload();
}

document.getElementById('botaoSair').addEventListener('click', sair);
document.getElementById('botaoSairNegado').addEventListener('click', sair);


/* ---------------------------------------------------------------------
   As abas
   --------------------------------------------------------------------- */
const secoes = {
    revisao: document.getElementById('secaoRevisao'),
    denuncias: document.getElementById('secaoDenuncias'),
    anunciantes: document.getElementById('secaoAnunciantes'),
    promocoes: document.getElementById('secaoPromocoes')
};

document.querySelectorAll('.aba').forEach(aba => {
    aba.addEventListener('click', () => {
        document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
        aba.classList.add('ativa');
        Object.entries(secoes).forEach(([nome, el]) => {
            el.hidden = nome !== aba.dataset.secao;
        });
    });
});


/* ---------------------------------------------------------------------
   Fila de revisão
   --------------------------------------------------------------------- */
async function carregarRevisao() {
    const { data, error } = await banco.rpc('admin_fila_de_revisao');
    const lista = document.getElementById('listaRevisao');

    if (error) {
        lista.textContent = 'Não consegui carregar a fila: ' + error.message;
        return;
    }

    document.getElementById('contaRevisao').textContent = (data || []).length;

    if (!data || !data.length) {
        listaVazia(lista, 'Nada esperando decisão. A fila vazia é o estado normal — '
            + 'ela só enche quando a triagem separa alguma coisa.');
        return;
    }

    lista.replaceChildren(...data.map(item => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha';

        caixa.append(
            identidade(item.nome, [
                etiqueta('Em revisão', 'ouro'),
                etiquetaDoPlano(item),
                item.denuncias > 0
                    ? etiqueta(item.denuncias + ' denúncia(s)', 'vermelha') : null,
                quando(item.criada_em)
            ], [
                item.anunciante,
                telefoneLegivel(item.telefone),
                item.relacao === 'moro' ? 'mora na casa'
                    : item.relacao === 'dono' ? 'dono do imóvel'
                    : item.relacao === 'responsavel' ? 'responsável' : null,
                item.cidade,
                `${item.anuncios_da_pessoa} anúncio(s) somando as contas parecidas`
            ]),

            acoes(
                botaoZap(item.telefone, `Olá, ${item.anunciante || ''}! Aqui é do Achei `
                    + `República, sobre o seu anúncio "${item.nome}".`),
                botaoAbrirVaga(item.id),
                botaoDeAcao('Liberar', 'btn-azul', async () => {
                    await mudarStatus(item.id, 'publicada', 'Anúncio liberado.');
                }),
                botaoQuePergunta('Recusar', 'btn-linha admin-recusar',
                    `Recusar "${item.nome}"? Ele sai da busca. O dono continua `
                    + 'enxergando o anúncio dele e pode corrigir.', async () => {
                    await mudarStatus(item.id, 'recusada',
                        'Anúncio recusado. Ele sai da busca e o dono continua enxergando o dele.');
                })
            )
        );

        /* A descrição inteira, e não um resumo: é nela que mora a palavra
           de imobiliária que trouxe o anúncio para cá. Cortar em três
           linhas esconderia justamente o motivo. */
        if (item.descricao) {
            const texto = document.createElement('p');
            texto.className = 'admin-texto';
            texto.textContent = item.descricao;
            caixa.appendChild(texto);
        }

        return caixa;
    }));
}

async function mudarStatus(id, status, recado) {
    const { error } = await banco.from('republicas').update({ status }).eq('id', id);
    if (error) return aviso('Não consegui mudar: ' + error.message);

    /* Confere que pegou de verdade. O gatilho da triagem devolve o status
       anterior sem dar erro quando quem pede não é administrador — sem
       esta conferência, o painel diria "liberado" e nada teria mudado. */
    const { data } = await banco.from('republicas').select('status').eq('id', id).maybeSingle();
    if (data && data.status !== status) {
        return aviso('O banco recusou a mudança em silêncio. Confira se a sua conta '
                   + 'está marcada como admin e se o 11 foi rodado.');
    }

    aviso(recado, 'certo');
    carregarTudo();
}

function botaoDeAcao(rotulo, classe, aoClicar) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + classe;
    b.textContent = rotulo;
    b.addEventListener('click', async () => {
        ocupado(b, true, 'Um instante...');
        await aoClicar();
        ocupado(b, false);
    });
    return b;
}

/* Pergunta antes do que tira alguma coisa do ar.

   Numa lista de linhas parecidas, com os botões todos do mesmo
   tamanho, um clique errado é fácil demais. */
function botaoQuePergunta(rotulo, classe, pergunta, aoClicar) {
    return botaoDeAcao(rotulo, classe, async () => {
        if (window.confirm(pergunta)) await aoClicar();
    });
}


/* ---------------------------------------------------------------------
   As peças de uma linha

   As quatro listas mostram coisas diferentes com a mesma forma: quem é
   à esquerda, em que pé está no meio, o que fazer à direita.
   --------------------------------------------------------------------- */
function etiqueta(texto, tom) {
    const e = document.createElement('span');
    e.className = 'admin-etiqueta etq-' + (tom || 'neutra');
    e.textContent = texto;
    return e;
}

function quando(iso) {
    const s = document.createElement('span');
    s.className = 'admin-quando';
    s.textContent = dataCurta(iso);
    return s;
}

/* O bloco da esquerda: um título com selos ao lado e uma linha fina de
   dados embaixo. Os nulos caem fora sozinhos. */
function identidade(titulo, selos, dados) {
    const bloco = document.createElement('div');
    bloco.className = 'admin-identidade';

    const nome = document.createElement('p');
    nome.className = 'admin-nome';
    nome.append(titulo);
    selos.filter(Boolean).forEach(s => nome.appendChild(s));

    const linha = document.createElement('p');
    linha.className = 'admin-dado';
    linha.textContent = dados.filter(Boolean).join(' · ');

    bloco.append(nome, linha);
    return bloco;
}

/* O BOTÃO DE FALAR

   O telefone já estava escrito na linha, mas chamar a pessoa dava
   trabalho: copiar, tirar o traço, montar o link. Agora é um clique, e
   a mensagem já vai escrita dizendo de onde vem o contato.

   Telefone torto não vira botão. Um link de wa.me com número quebrado
   abre uma conversa com ninguém, e isso é pior do que não ter botão:
   parece que funcionou. */
const DESENHO_ZAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14'
    + '.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.'
    + '2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.'
    + '02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15'
    + '-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 '
    + '1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.6'
    + '3.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.1'
    + '3-.27-.2-.57-.35M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L'
    + '2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65'
    + '-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2"/></svg>';

function botaoZap(telefone, mensagem) {
    const d = (telefone || '').replace(/\D/g, '');
    if (d.length < 10 || d.length > 11) return null;

    const a = document.createElement('a');
    a.className = 'btn admin-zap';
    a.href = 'https://wa.me/55' + d + '?text=' + encodeURIComponent(mensagem);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Falar no WhatsApp';
    a.innerHTML = DESENHO_ZAP;
    a.append('Falar');
    return a;
}

function botaoAbrirVaga(id) {
    const a = document.createElement('a');
    a.className = 'btn btn-linha';
    a.href = '../vaga.html?id=' + id;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Abrir a vaga';
    return a;
}

function acoes(...botoes) {
    const div = document.createElement('div');
    div.className = 'admin-acoes';
    botoes.filter(Boolean).forEach(b => div.appendChild(b));
    return div;
}

/* A ETIQUETA DE PLANO

   Grátis, Destaque ou Premium — e o que vale é o destaque VIGENTE, não
   o que já foi pago um dia. destaqueValendo() vem do planos.js e
   devolve nulo quando a data passou, então uma vaga com destaque
   vencido aparece como Grátis, que é o que ela é hoje na busca.

   Quando o campo não veio na consulta, a etiqueta some em vez de dizer
   "Grátis". É o caso de quem ainda não rodou o 20-plano-no-painel.sql:
   inventar "Grátis" ali marcaria de graça uma vaga premium. */
function etiquetaDoPlano(vaga) {
    if (!('destaque' in vaga)) return null;

    const plano = destaqueValendo(vaga);
    if (!plano) return etiqueta('Grátis', 'neutra');

    return etiqueta(
        ((SELO_DO_PLANO[plano] || '') + ' ' + (NOME_DO_PLANO[plano] || plano)).trim(),
        'ouro');
}

function listaVazia(lista, frase) {
    lista.replaceChildren();
    const p = document.createElement('p');
    p.className = 'admin-vazio';
    p.textContent = frase;
    lista.appendChild(p);
}


/* ---------------------------------------------------------------------
   Denúncias
   --------------------------------------------------------------------- */
const MOTIVOS = {
    imobiliaria: 'É de imobiliária ou corretor',
    anuncio_falso: 'O anúncio é falso',
    golpe: 'Parece golpe',
    ja_alugada: 'A vaga já foi alugada',
    outro: 'Outro motivo'
};

async function carregarDenuncias() {
    const { data, error } = await banco.rpc('admin_denuncias');
    const lista = document.getElementById('listaDenuncias');

    if (error) {
        lista.textContent = 'Não consegui carregar as denúncias: ' + error.message;
        return;
    }

    document.getElementById('contaDenuncias').textContent = (data || []).length;

    if (!data || !data.length) {
        listaVazia(lista, 'Nenhuma denúncia até agora.');
        return;
    }

    lista.replaceChildren(...data.map(d => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha';

        caixa.append(
            identidade(MOTIVOS[d.motivo] || d.motivo, [
                d.ativa ? etiqueta('No ar', 'verde') : etiqueta('Fora do ar', 'neutra'),
                etiquetaDoPlano(d),
                d.status !== 'publicada'
                    ? etiqueta(d.status.replace('_', ' '), 'ouro') : null,
                quando(d.criada_em)
            ], [
                d.republica, d.cidade, d.anunciante, telefoneLegivel(d.telefone)
            ]),

            acoes(
                botaoZap(d.telefone, `Olá, ${d.anunciante || ''}! Aqui é do Achei `
                    + `República, sobre o anúncio "${d.republica}".`),
                botaoAbrirVaga(d.republica_id),
                d.ativa
                    ? botaoQuePergunta('Tirar do ar', 'btn-linha admin-recusar',
                        `Tirar "${d.republica}" do ar? O anúncio some da busca `
                        + 'na hora. O dono consegue publicar de novo.', async () => {
                        const { error: e } = await banco.from('republicas')
                            .update({ ativa: false }).eq('id', d.republica_id);
                        if (e) return aviso('Não consegui tirar do ar: ' + e.message);
                        aviso('Anúncio fora do ar.', 'certo');
                        carregarTudo();
                    })
                    : null
            )
        );

        if (d.detalhe) {
            const texto = document.createElement('p');
            texto.className = 'admin-texto';
            texto.textContent = d.detalhe;
            caixa.appendChild(texto);
        }

        return caixa;
    }));
}


/* ---------------------------------------------------------------------
   Anunciantes
   --------------------------------------------------------------------- */
/* A lista inteira fica aqui depois de carregada. O filtro peneira esta
   cópia em vez de ir ao banco a cada letra digitada. */
let anunciantes = [];

async function carregarAnunciantes() {
    const { data, error } = await banco.rpc('admin_anunciantes');
    const lista = document.getElementById('listaAnunciantes');

    if (error) {
        lista.textContent = 'Não consegui carregar os anunciantes: ' + error.message;
        return;
    }

    anunciantes = data || [];
    document.getElementById('contaAnunciantes').textContent = anunciantes.length;
    desenharAnunciantes();
}

function anuncianteCombina(a, situacao, termo) {
    const passaSituacao =
          situacao === ''            ? true
        : situacao === 'no_ar'       ? a.anuncios_no_ar > 0
        : situacao === 'sem_anuncio' ? a.anuncios_no_total === 0
        : situacao === 'liberado'    ? a.limite_anuncios > 1
        : situacao === 'denunciado'  ? a.denuncias > 0
        : situacao === 'bloqueado'   ? a.bloqueado
        : true;

    if (!passaSituacao) return false;
    if (!termo) return true;

    if ([a.nome, a.email].filter(Boolean).join(' ').toLowerCase().includes(termo)) {
        return true;
    }

    /* O telefone se compara só pelos dígitos: quem procura escreve
       "31 99934" e o que está gravado é 31999347032. Três dígitos é o
       mínimo para a busca não casar com meio mundo. */
    const digitos = termo.replace(/\D/g, '');
    return digitos.length >= 3
        && (a.telefone || '').replace(/\D/g, '').includes(digitos);
}

function desenharAnunciantes() {
    const lista = document.getElementById('listaAnunciantes');
    const situacao = document.getElementById('filtroSituacao').value;
    const termo = document.getElementById('filtroTermo').value.trim().toLowerCase();

    if (!anunciantes.length) {
        listaVazia(lista, 'Nenhuma conta de anunciante ainda.');
        return;
    }

    const visiveis = anunciantes.filter(a => anuncianteCombina(a, situacao, termo));

    if (!visiveis.length) {
        listaVazia(lista, 'Nenhuma conta com esse filtro.');
        return;
    }

    lista.replaceChildren(...visiveis.map(a => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha' + (a.bloqueado ? ' bloqueado' : '');

        /* O teto é um número, e não um "liberado sim/não": quem tem três
           repúblicas de verdade recebe 3. A diferença aparece no dia em
           que a conta liberada começa a anunciar a décima. */
        const menos = botaoDeAcao('−1 no teto', 'btn-linha', async () => {
            await mudarTeto(a.id, Math.max(1, a.limite_anuncios - 1));
        });
        menos.disabled = a.limite_anuncios <= 1;

        caixa.append(
            identidade(a.nome || '(sem nome)', [
                a.bloqueado ? etiqueta('Bloqueado', 'vermelha')
                    : a.anuncios_no_ar > 0 ? etiqueta('No ar', 'verde')
                    : etiqueta('Sem anúncio', 'neutra'),
                a.admin ? etiqueta('Admin', 'azul') : null,
                a.denuncias > 0 ? etiqueta(a.denuncias + ' denúncia(s)', 'vermelha') : null
            ], [
                a.email,
                telefoneLegivel(a.telefone),
                `${a.anuncios_no_ar} no ar de ${a.anuncios_no_total}`,
                `teto ${a.limite_anuncios}`
            ]),

            acoes(
                botaoZap(a.telefone,
                    `Olá, ${a.nome || ''}! Aqui é do Achei República.`),
                botaoDeAcao('+1 no teto', 'btn-linha', async () => {
                    await mudarTeto(a.id, Math.min(50, a.limite_anuncios + 1));
                }),
                menos,
                a.bloqueado
                    ? botaoDeAcao('Desbloquear', 'btn-linha', async () => {
                        await mudarBloqueio(a, false);
                    })
                    : botaoQuePergunta('Bloquear', 'btn-linha admin-recusar',
                        `Bloquear a conta de ${a.nome || a.email}? Ela para de publicar. `
                        + 'Os anúncios que já existem continuam no ar.', async () => {
                        await mudarBloqueio(a, true);
                    })
            )
        );

        return caixa;
    }));
}

async function mudarBloqueio(a, bloquear) {
    const { error } = await banco.from('perfis')
        .update({ bloqueado: bloquear }).eq('id', a.id);
    if (error) return aviso('Não consegui mudar: ' + error.message);
    aviso(bloquear
        ? 'Conta bloqueada. Ela não publica mais, e os anúncios que já existem continuam.'
        : 'Conta desbloqueada.', 'certo');
    carregarTudo();
}

/* O filtro trabalha enquanto se digita. O botão continua ali para quem
   espera apertar alguma coisa, e não faz mais do que já foi feito. */
const filtroAnunciantes = document.getElementById('filtroAnunciantes');
if (filtroAnunciantes) {
    filtroAnunciantes.addEventListener('submit', e => e.preventDefault());
    filtroAnunciantes.addEventListener('input', desenharAnunciantes);
    filtroAnunciantes.addEventListener('change', desenharAnunciantes);
}

async function mudarTeto(id, novo) {
    const { error } = await banco.from('perfis')
        .update({ limite_anuncios: novo }).eq('id', id);
    if (error) return aviso('Não consegui mudar o teto: ' + error.message);
    aviso(`Teto agora é ${novo} anúncio(s) no ar.`, 'certo');
    carregarTudo();
}


/* ---------------------------------------------------------------------
   DESTAQUES CONTRATADOS

   A tela onde se olha dinheiro. Duas coisas que ela NÃO faz, e as duas
   são de propósito:

   1. Não acende destaque. Acender é o webhook, depois de perguntar ao
      Mercado Pago se o pagamento foi mesmo aprovado. Um botão "ativar"
      aqui seria a porta dos fundos que o resto do desenho passou o dia
      inteiro trancando — e a primeira coisa que alguém pediria pelo
      WhatsApp: "ativa aí pra mim que eu te pago depois".

   2. Não estorna. Devolver dinheiro é no painel do Mercado Pago, com o
      registro deles. Aqui você cancela o destaque, que é a parte que
      pertence a este site.
   --------------------------------------------------------------------- */
const SITUACAO_DA_PROMOCAO = {
    aguardando: 'esperando o pagamento',
    ativa: 'no ar',
    expirada: 'terminou',
    cancelada: 'cancelada por você',
    recusada: 'pagamento não aprovado'
};

async function carregarPromocoes() {
    const { data, error } = await banco.rpc('admin_promocoes');
    const lista = document.getElementById('listaPromocoes');

    if (error) {
        lista.textContent = 'Não consegui carregar os destaques: ' + error.message;
        return;
    }

    /* A conta na aba mostra as ATIVAS, e não o total de todos os tempos.
       Um número que só cresce não é informação — o que interessa saber
       de relance é quantas vagas estão destacadas agora. */
    const ativas = (data || []).filter(p => p.status === 'ativa');
    document.getElementById('contaPromocoes').textContent = ativas.length;

    if (!data || !data.length) {
        listaVazia(lista, 'Nenhum destaque contratado ainda.');
        return;
    }

    const TOM_DA_SITUACAO = {
        ativa: 'verde',
        aguardando: 'ouro',
        expirada: 'neutra',
        cancelada: 'vermelha',
        recusada: 'vermelha'
    };

    lista.replaceChildren(...data.map(p => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha';
        if (p.status === 'ativa') caixa.classList.add('promocao-ativa');

        caixa.appendChild(identidade(p.republica, [
            etiqueta(((SELO_DO_PLANO[p.plano] || '') + ' '
                + (NOME_DO_PLANO[p.plano] || p.plano)).trim(), 'ouro'),
            etiqueta(SITUACAO_DA_PROMOCAO[p.status] || p.status,
                TOM_DA_SITUACAO[p.status] || 'neutra'),
            // A vaga fora do ar com destaque pago é o caso que gera
            // telefonema: "paguei e sumiu". Fica em vermelho na linha.
            p.status === 'ativa' && !p.vaga_no_ar
                ? etiqueta('Vaga fora do ar', 'vermelha') : null
        ], [
            emReais(p.preco_centavos),
            p.anunciante,
            telefoneLegivel(p.telefone),
            p.comeca_em ? `de ${dataCurtaBR(p.comeca_em)} a ${dataCurtaBR(p.termina_em)}` : null,
            p.status === 'ativa' ? frasedeDiasRestantes(p.termina_em) : null,
            p.metodo || null,
            p.referencia ? `pagamento ${p.referencia}` : null
        ]));

        if (p.status === 'ativa' || p.status === 'aguardando') {
            const acoes = document.createElement('div');
            acoes.className = 'admin-acoes';

            const falar = botaoZap(p.telefone,
                `Olá, ${p.anunciante || ''}! Aqui é do Achei República, sobre o `
                + `destaque da vaga "${p.republica}".`);
            if (falar) acoes.appendChild(falar);

            acoes.appendChild(botaoDeAcao('Cancelar destaque', 'btn-linha admin-recusar', async () => {
                const motivo = prompt(
                    'Por que este destaque está sendo cancelado?\n'
                    + '(fica gravado, e é o que explica a decisão daqui a três meses)');

                // Cancelar sem motivo é o começo de uma discussão sem
                // prova. Fechar a caixa desiste da ação inteira.
                if (motivo === null) return;

                const { error: e } = await banco.rpc('admin_cancelar_promocao', {
                    p_promocao: p.id,
                    p_motivo: motivo
                });

                if (e) return aviso('Não consegui cancelar: ' + e.message);
                aviso('Destaque cancelado. O estorno, se for o caso, é no painel do '
                    + 'Mercado Pago — aqui só apagamos o destaque.', 'certo');
                carregarTudo();
            }));

            caixa.appendChild(acoes);
        }

        return caixa;
    }));
}

/* Passa as vencidas de "ativa" para "expirada". Não desliga destaque
   nenhum: o destaque já parou sozinho no segundo em que a data passou,
   porque tudo no site compara com a hora de agora. Isto arruma o
   rótulo desta tela. */
const botaoExpirar = document.getElementById('botaoExpirar');
if (botaoExpirar) {
    botaoExpirar.addEventListener('click', async () => {
        const { data, error } = await banco.rpc('expirar_promocoes');
        if (error) return aviso('Não consegui arrumar: ' + error.message);
        aviso(data
            ? `${data} destaque(s) marcados como terminados.`
            : 'Nenhum destaque vencido para arrumar.', 'certo');
        carregarPromocoes();
    });
}


/* ---------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------- */
/* O telefone sai legível, mas só quando está inteiro.

   Número torto aparece cru de propósito: foi vendo "(55) 31983-0369"
   nesta lista que a gente descobriu que a máscara antiga engolia dois
   dígitos. Formatar tudo esconderia a próxima. */
function telefoneLegivel(t) {
    const d = (t || '').replace(/\D/g, '');
    return d.length === 10 || d.length === 11 ? mascararTelefone(d) : (t || '');
}

function dataCurta(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
         + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function carregarTudo() {
    carregarRevisao();
    carregarDenuncias();
    carregarAnunciantes();
    carregarPromocoes();
}


/* ---------------------------------------------------------------------
   A porta de entrada
   --------------------------------------------------------------------- */
async function abrir() {
    const { data } = await banco.auth.getSession();

    verificando.hidden = true;

    if (!data.session) {
        telaEntrar.hidden = false;
        return;
    }

    usuario = data.session.user;
    document.getElementById('botaoSair').hidden = false;

    // A pergunta vai ao banco, e não fica no navegador: a resposta que
    // vale é a das regras, e é ela que decide o que as listas devolvem.
    const { data: perfil } = await banco.from('perfis')
        .select('nome, admin').eq('id', usuario.id).maybeSingle();

    if (!perfil || !perfil.admin) {
        telaEntrar.hidden = true;
        telaNegado.hidden = false;
        return;
    }

    telaEntrar.hidden = true;
    painel.hidden = false;
    document.getElementById('quemSou').textContent =
        `${perfil.nome || usuario.email} · ${usuario.email}`;

    carregarTudo();
}

if (!banco) {
    verificando.textContent =
        'O site ainda não está ligado ao banco. Confira o js/supabase-config.js.';
} else {
    abrir();
}
