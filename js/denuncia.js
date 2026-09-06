/* =====================================================================
   Achei República — denunciar anúncio.

   Quem reconhece anúncio de imobiliária é o estudante: ele já viu o
   mesmo texto, com a mesma foto, em três sites diferentes. Nenhuma
   regra automática chega perto disso.

   Por isso denunciar não pede conta. Exigir login para denunciar é o
   mesmo que não ter denúncia: a pessoa fecha a aba e o anúncio fica.
   A tabela do banco não tem regra de leitura, então as denúncias só se
   abrem para você, no painel do Supabase — ninguém consegue ler pelo
   site quem denunciou o quê.
   ===================================================================== */

const cfgDenuncia = window.CONFIG_SUPABASE || {};
const bancoDenuncia = (cfgDenuncia.url && !cfgDenuncia.url.startsWith('COLE_AQUI') && window.supabase)
    ? window.supabase.createClient(cfgDenuncia.url, cfgDenuncia.chavePublica)
    : null;

const janela = document.getElementById('denuncia');

if (janela) {
    const caixa       = janela.querySelector('.denuncia-caixa');
    const alvo        = document.getElementById('denunciaAlvo');
    const formulario  = document.getElementById('denunciaForm');
    const detalhe     = document.getElementById('denunciaDetalhe');
    const enviar      = document.getElementById('denunciaEnviar');
    const obrigado    = document.getElementById('denunciaObrigado');
    const erro        = document.getElementById('denunciaErro');
    const fechar      = document.getElementById('denunciaFechar');

    let idDaVez = null;
    let quemAbriu = null;

    function abrir(botao) {
        const cartao = botao.closest('.anuncio');
        idDaVez = cartao ? (cartao.dataset.id || '') : '';
        quemAbriu = botao;

        const nome = cartao ? cartao.querySelector('h3') : null;
        alvo.textContent = nome ? nome.textContent : 'este anúncio';

        formulario.hidden = false;
        formulario.reset();
        obrigado.hidden = true;
        erro.hidden = true;

        janela.hidden = false;
        document.body.style.overflow = 'hidden';

        const primeiro = formulario.querySelector('input[type="radio"]');
        if (primeiro) primeiro.focus();
    }

    function fecharJanela() {
        janela.hidden = true;
        document.body.style.overflow = '';
        if (quemAbriu) quemAbriu.focus();
    }

    /* Delegação, e não um ouvinte por botão: os cartões das
       repúblicas chegam do banco depois desta linha rodar, e ligados um
       a um os novos nasceriam sem denúncia — justamente os anúncios de
       verdade, que são os únicos que dá para denunciar. */
    document.addEventListener('click', evento => {
        const botao = evento.target.closest('.denunciar');
        if (botao) abrir(botao);
    });

    fechar.addEventListener('click', fecharJanela);

    /* Clicar no escuro em volta fecha; clicar dentro da caixa, não. */
    janela.addEventListener('click', evento => {
        if (!caixa.contains(evento.target)) fecharJanela();
    });

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && !janela.hidden) fecharJanela();
    });

    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.hidden = true;

        const escolhido = formulario.querySelector('input[name="motivo"]:checked');
        if (!escolhido) {
            erro.textContent = 'Escolha o motivo da denúncia.';
            erro.hidden = false;
            return;
        }

        /* Os cartões da vitrine ainda são maquete: não têm anúncio de
         * verdade por trás. Dizer isso é melhor do que fingir que
         * enviou. Quando a lista vier do banco, cada cartão traz o seu
         * data-id e este trecho para de aparecer sozinho. */
        if (!idDaVez) {
            formulario.hidden = true;
            obrigado.textContent = 'Este é um anúncio de demonstração, então não há o que denunciar ainda. ' +
                                   'Nos anúncios de verdade, a denúncia chega para a gente na hora.';
            obrigado.hidden = false;
            return;
        }

        if (!bancoDenuncia) {
            erro.textContent = 'O site ainda não está ligado ao banco. Tente daqui a pouco.';
            erro.hidden = false;
            return;
        }

        enviar.disabled = true;
        enviar.textContent = 'Enviando...';

        /* Se a pessoa estiver logada, guardamos quem foi — ajuda a ver
         * quando alguém denuncia o concorrente em série. Sem login, a
         * denúncia entra anônima do mesmo jeito. */
        const { data: sessao } = await bancoDenuncia.auth.getSession();

        const { error } = await bancoDenuncia.from('denuncias').insert({
            republica_id: idDaVez,
            autor_id: sessao.session ? sessao.session.user.id : null,
            motivo: escolhido.value,
            detalhe: detalhe.value.trim() || null
        });

        enviar.disabled = false;
        enviar.textContent = 'Enviar denúncia';

        if (error) {
            erro.textContent = 'Não deu para enviar agora. Tente de novo daqui a pouco.';
            erro.hidden = false;
            return;
        }

        formulario.hidden = true;
        obrigado.textContent = 'Denúncia recebida. A gente olha uma por uma — obrigado por avisar.';
        obrigado.hidden = false;
    });
}
