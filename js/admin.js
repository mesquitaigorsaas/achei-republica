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
        lista.innerHTML = '<p class="conta-linha-fina">Nada esperando decisão. '
            + 'A fila vazia é o estado normal — ela só enche quando a triagem separa alguma coisa.</p>';
        return;
    }

    lista.replaceChildren(...data.map(item => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha';

        const topo = document.createElement('div');
        topo.className = 'admin-linha-topo';

        const nome = document.createElement('b');
        nome.textContent = item.nome;

        const quando = document.createElement('small');
        quando.textContent = dataCurta(item.criada_em);

        topo.append(nome, quando);

        const quem = document.createElement('p');
        quem.className = 'admin-dado';
        quem.textContent = [
            item.anunciante,
            item.telefone,
            item.relacao === 'moro' ? 'mora na casa'
                : item.relacao === 'dono' ? 'dono do imóvel'
                : item.relacao === 'responsavel' ? 'responsável' : null,
            item.cidade,
            `${item.anuncios_da_pessoa} anúncio(s) somando as contas parecidas`,
            item.denuncias > 0 ? `${item.denuncias} denúncia(s)` : null
        ].filter(Boolean).join(' · ');

        caixa.append(topo, quem);

        /* A descrição inteira, e não um resumo: é nela que mora a palavra
           de imobiliária que trouxe o anúncio para cá. Cortar em três
           linhas esconderia justamente o motivo. */
        if (item.descricao) {
            const texto = document.createElement('p');
            texto.className = 'admin-texto';
            texto.textContent = item.descricao;
            caixa.appendChild(texto);
        }

        const acoes = document.createElement('div');
        acoes.className = 'admin-acoes';

        const ver = document.createElement('a');
        ver.className = 'btn btn-linha';
        ver.href = `../vaga.html?id=${item.id}`;
        ver.target = '_blank';
        ver.rel = 'noopener';
        ver.textContent = 'Abrir a vaga';

        acoes.append(
            ver,
            botaoDeAcao('Liberar', 'btn-azul', async () => {
                await mudarStatus(item.id, 'publicada', 'Anúncio liberado.');
            }),
            botaoDeAcao('Recusar', 'btn-linha admin-recusar', async () => {
                await mudarStatus(item.id, 'recusada',
                    'Anúncio recusado. Ele sai da busca e o dono continua enxergando o dele.');
            })
        );

        caixa.appendChild(acoes);
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
        lista.innerHTML = '<p class="conta-linha-fina">Nenhuma denúncia até agora.</p>';
        return;
    }

    lista.replaceChildren(...data.map(d => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha';

        const topo = document.createElement('div');
        topo.className = 'admin-linha-topo';

        const motivo = document.createElement('b');
        motivo.textContent = MOTIVOS[d.motivo] || d.motivo;

        const quando = document.createElement('small');
        quando.textContent = dataCurta(d.criada_em);

        topo.append(motivo, quando);

        const sobre = document.createElement('p');
        sobre.className = 'admin-dado';
        sobre.textContent = [
            d.republica, d.cidade, d.anunciante, d.telefone,
            d.ativa ? 'no ar' : 'fora do ar',
            d.status !== 'publicada' ? d.status.replace('_', ' ') : null
        ].filter(Boolean).join(' · ');

        caixa.append(topo, sobre);

        if (d.detalhe) {
            const texto = document.createElement('p');
            texto.className = 'admin-texto';
            texto.textContent = d.detalhe;
            caixa.appendChild(texto);
        }

        const acoes = document.createElement('div');
        acoes.className = 'admin-acoes';

        const ver = document.createElement('a');
        ver.className = 'btn btn-linha';
        ver.href = `../vaga.html?id=${d.republica_id}`;
        ver.target = '_blank';
        ver.rel = 'noopener';
        ver.textContent = 'Abrir a vaga';
        acoes.appendChild(ver);

        if (d.ativa) {
            acoes.appendChild(botaoDeAcao('Tirar do ar', 'btn-linha admin-recusar', async () => {
                const { error: e } = await banco.from('republicas')
                    .update({ ativa: false }).eq('id', d.republica_id);
                if (e) return aviso('Não consegui tirar do ar: ' + e.message);
                aviso('Anúncio fora do ar.', 'certo');
                carregarTudo();
            }));
        }

        caixa.appendChild(acoes);
        return caixa;
    }));
}


/* ---------------------------------------------------------------------
   Anunciantes
   --------------------------------------------------------------------- */
async function carregarAnunciantes() {
    const { data, error } = await banco.rpc('admin_anunciantes');
    const lista = document.getElementById('listaAnunciantes');

    if (error) {
        lista.textContent = 'Não consegui carregar os anunciantes: ' + error.message;
        return;
    }

    document.getElementById('contaAnunciantes').textContent = (data || []).length;

    if (!data || !data.length) {
        lista.innerHTML = '<p class="conta-linha-fina">Nenhuma conta de anunciante ainda.</p>';
        return;
    }

    lista.replaceChildren(...data.map(a => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha' + (a.bloqueado ? ' bloqueado' : '');

        const topo = document.createElement('div');
        topo.className = 'admin-linha-topo';

        const nome = document.createElement('b');
        nome.textContent = a.nome || '(sem nome)';

        const selos = document.createElement('small');
        selos.textContent = [
            a.admin ? 'ADMIN' : null,
            a.bloqueado ? 'BLOQUEADO' : null
        ].filter(Boolean).join(' · ');

        topo.append(nome, selos);

        const dados = document.createElement('p');
        dados.className = 'admin-dado';
        dados.textContent = [
            a.email, a.telefone,
            `${a.anuncios_no_ar} no ar de ${a.anuncios_no_total}`,
            `teto ${a.limite_anuncios}`,
            a.denuncias > 0 ? `${a.denuncias} denúncia(s)` : null
        ].filter(Boolean).join(' · ');

        caixa.append(topo, dados);

        const acoes = document.createElement('div');
        acoes.className = 'admin-acoes';

        /* O teto é um número, e não um "liberado sim/não": quem tem três
           repúblicas de verdade recebe 3. A diferença aparece no dia em
           que a conta liberada começa a anunciar a décima. */
        const menos = botaoDeAcao('−1 no teto', 'btn-linha', async () => {
            await mudarTeto(a.id, Math.max(1, a.limite_anuncios - 1));
        });
        menos.disabled = a.limite_anuncios <= 1;

        acoes.append(
            botaoDeAcao('+1 no teto', 'btn-linha', async () => {
                await mudarTeto(a.id, Math.min(50, a.limite_anuncios + 1));
            }),
            menos,
            botaoDeAcao(a.bloqueado ? 'Desbloquear' : 'Bloquear',
                'btn-linha' + (a.bloqueado ? '' : ' admin-recusar'), async () => {
                const { error: e } = await banco.from('perfis')
                    .update({ bloqueado: !a.bloqueado }).eq('id', a.id);
                if (e) return aviso('Não consegui mudar: ' + e.message);
                aviso(a.bloqueado
                    ? 'Conta desbloqueada.'
                    : 'Conta bloqueada. Ela não publica mais, e os anúncios que já existem continuam.',
                    'certo');
                carregarTudo();
            })
        );

        caixa.appendChild(acoes);
        return caixa;
    }));
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
        lista.innerHTML = '<p class="conta-linha-fina">Nenhum destaque contratado ainda.</p>';
        return;
    }

    lista.replaceChildren(...data.map(p => {
        const caixa = document.createElement('div');
        caixa.className = 'admin-linha';
        if (p.status === 'ativa') caixa.classList.add('promocao-ativa');

        const topo = document.createElement('div');
        topo.className = 'admin-linha-topo';

        const nome = document.createElement('b');
        nome.textContent = `${SELO_DO_PLANO[p.plano] || ''} ${NOME_DO_PLANO[p.plano] || p.plano}`
            + ` — ${p.republica}`;

        const situacao = document.createElement('small');
        situacao.textContent = (SITUACAO_DA_PROMOCAO[p.status] || p.status).toUpperCase();

        topo.append(nome, situacao);

        const dados = document.createElement('p');
        dados.className = 'admin-dado';
        dados.textContent = [
            emReais(p.preco_centavos),
            p.anunciante,
            p.telefone,
            p.comeca_em ? `de ${dataCurtaBR(p.comeca_em)} a ${dataCurtaBR(p.termina_em)}` : null,
            p.status === 'ativa' ? frasedeDiasRestantes(p.termina_em) : null,
            // A vaga fora do ar com destaque pago é o caso que gera
            // telefonema: "paguei e sumiu". Fica escrito na linha.
            p.status === 'ativa' && !p.vaga_no_ar ? 'VAGA FORA DO AR — destaque pausado' : null,
            p.metodo || null,
            p.referencia ? `pagamento ${p.referencia}` : null
        ].filter(Boolean).join(' · ');

        caixa.append(topo, dados);

        if (p.status === 'ativa' || p.status === 'aguardando') {
            const acoes = document.createElement('div');
            acoes.className = 'admin-acoes';

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
