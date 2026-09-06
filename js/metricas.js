/* =====================================================================
   Achei República — contar o que aconteceu com a vaga

   Quem paga R$ 39,90 vai perguntar o que ganhou. Este arquivo é o que
   permite responder com número em vez de "confia".

   Três coisas são contadas:

     vitrine — a vaga APARECEU numa lista de resultados
     visita  — alguém abriu a página dela
     contato — alguém clicou no WhatsApp

   ---------------------------------------------------------------------
   AS TRÊS REGRAS QUE FAZEM O NÚMERO SIGNIFICAR ALGUMA COISA
   ---------------------------------------------------------------------

   1. UMA VEZ POR SESSÃO, POR VAGA, POR TIPO.

      Sem isto, rolar a página para cima e para baixo contaria vinte
      aparições da mesma casa, e "apareceu 240 vezes" viraria uma
      mentira educada. O crachá fica no sessionStorage: fecha a aba,
      zera. É o recorte mais próximo de "uma pessoa procurando" que dá
      para ter sem identificar ninguém.

   2. EM LOTE, E DEPOIS.

      A home mostra doze cartões de uma vez. Doze chamadas seriam doze
      viagens ao servidor antes de a pessoa ver a lista. A fila junta e
      manda uma vez só, quando o navegador estiver ocioso.

   3. FALHAR É PERMITIDO, EM SILÊNCIO.

      Se a contagem cair, ninguém pode perceber. O estudante está
      procurando casa; um erro vermelho na tela porque uma estatística
      não subiu seria trocar o que importa pelo que não importa.

   ---------------------------------------------------------------------
   O QUE NÃO É ENVIADO

   Nada sobre quem está olhando. Sem IP, sem identificador, sem
   histórico. O que sobe é: id da vaga, tipo do evento, de onde veio. O
   banco soma num contador por dia. Não existe, em lugar nenhum, uma
   linha que diga que uma pessoa viu uma casa.
   ===================================================================== */

const cfgMetricas = window.CONFIG_SUPABASE || {};
const bancoMetricas =
    (cfgMetricas.url && !cfgMetricas.url.startsWith('COLE_AQUI') && window.supabase)
        ? window.supabase.createClient(cfgMetricas.url, cfgMetricas.chavePublica, {
            /* Sem sessão: contar não depende de quem está logado, e
               assim este cliente não disputa o armazenamento de login
               com o resto da página. */
            auth: { persistSession: false, autoRefreshToken: false },
        })
        : null;

const filaDeMetricas = [];
let entregaMarcada = null;

/* O crachá de "já contei este". sessionStorage e não localStorage: a
   contagem é por visita, não por navegador para sempre. */
function jaContou(chave) {
    try {
        if (sessionStorage.getItem(chave)) return true;
        sessionStorage.setItem(chave, '1');
        return false;
    } catch (e) {
        /* Navegador em janela anônima com armazenamento bloqueado. Sem
           crachá, conta de novo — número inflado é melhor que página
           quebrada por causa de uma estatística. */
        return false;
    }
}

async function entregar() {
    entregaMarcada = null;
    if (!bancoMetricas || !filaDeMetricas.length) return;

    /* O banco recusa lotes acima de 60. Manda em fatias, e o que
       sobrar vai na próxima rodada. */
    const lote = filaDeMetricas.splice(0, 60);

    try {
        await bancoMetricas.rpc('registrar_metricas', { eventos: lote });
    } catch (e) {
        /* Silêncio de propósito — veja a regra 3. O console fica com o
           motivo para quem for consertar. */
        console.debug('Métrica não registrada:', e);
    }

    if (filaDeMetricas.length) marcarEntrega();
}

function marcarEntrega() {
    if (entregaMarcada) return;

    /* requestIdleCallback espera o navegador ficar sem nada melhor para
       fazer. Onde ele não existe (Safari antigo), um segundo de atraso
       resolve igual: o que não pode é entregar no meio da montagem da
       lista. */
    entregaMarcada = window.requestIdleCallback
        ? requestIdleCallback(entregar, { timeout: 3000 })
        : setTimeout(entregar, 1000);
}

/* ---------------------------------------------------------------------
   A porta de entrada

   registrarMetrica('uuid-da-vaga', 'visita', 'direto')

   origem: 'vitrine' | 'filtro' | 'match' | 'direto'
   --------------------------------------------------------------------- */
function registrarMetrica(id, tipo, origem) {
    if (!id || !bancoMetricas) return;
    if (jaContou(`metrica:${tipo}:${id}`)) return;

    filaDeMetricas.push({ id, tipo, origem: origem || 'direto' });
    marcarEntrega();
}

/* Vários de uma vez — é como a vitrine registra os cartões que a pessoa
   acabou de ver. */
function registrarMetricas(ids, tipo, origem) {
    (ids || []).forEach(id => registrarMetrica(id, tipo, origem));
}

/* Sair da página não pode engolir a fila. 'pagehide' pega o fechamento
   e a navegação para trás no celular, onde 'beforeunload' não dispara.

   Isto é entrega de melhor esforço: a chamada pode não completar. Vale
   mais que não tentar — e é por isso que a fila é esvaziada cedo, no
   ocioso, em vez de só aqui. */
window.addEventListener('pagehide', () => { entregar(); });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') entregar();
});

window.registrarMetrica = registrarMetrica;
window.registrarMetricas = registrarMetricas;


/* ---------------------------------------------------------------------
   O QUE O ESTUDANTE PROCUROU

   Hoje o questionário da home coleta cidade, faculdade, curso, teto de
   preço e tempo de trajeto, calcula a compatibilidade e joga tudo fora
   quando a aba fecha.

   Guardar isso é o que um dia vai permitir dizer a uma república, com
   número na mão: "sete estudantes procuraram até R$ 700 em Alfenas
   este mês, e quatro querem entrada imediata". É o argumento de venda
   mais forte que existe, e ele vem de graça do que já é digitado.

   SEM DONO, e a decisão é de projeto: resposta ligada a uma pessoa é
   perfil de comportamento; solta, é pesquisa de mercado. A segunda
   responde a pergunta comercial inteira e não cria um dado que eu
   teria que proteger.

   A tela que mostra isso não existe ainda — de propósito, porque com
   pouca busca acumulada ela mostraria "1 estudante procura", que é
   pior que não mostrar nada. O que existe é o dado começando a
   acumular desde já, que é a parte que não dá para fazer depois.
   --------------------------------------------------------------------- */
async function registrarBusca(resposta) {
    if (!bancoMetricas || !resposta || !resposta.cidade) return;
    if (jaContou('busca:' + resposta.cidade)) return;

    try {
        await bancoMetricas.rpc('registrar_busca', {
            p_cidade: resposta.cidade,
            p_faculdade: resposta.uni || '',
            p_curso: resposta.curso || '',
            p_teto: Number(resposta.teto) || null,
            p_tempo: Number(resposta.tempo) || null,
            p_jeito: resposta.jeito || [],
        });
    } catch (e) {
        console.debug('Busca não registrada:', e);
    }
}

window.registrarBusca = registrarBusca;
