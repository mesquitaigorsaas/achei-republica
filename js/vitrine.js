/* =====================================================================
   Achei República — a vitrine, agora vinda do banco

   Até aqui os seis anúncios da home eram HTML escrito à mão. Bonitos e
   mentirosos: ninguém tinha cadastrado nenhum, e não havia como
   cadastrar. Este arquivo busca as repúblicas de verdade e as coloca
   na mesma vitrine.

   A decisão que faz isto caber em pouca coisa: em vez de reescrever o
   questionário, as fichas e o cálculo de compatibilidade para lerem
   objetos, os anúncios do banco viram cartões com EXATAMENTE os mesmos
   atributos data-* dos de exemplo. O script.js continua fazendo o que
   já fazia, sem saber de onde o cartão veio.

   Carregado DEPOIS do script.js, que é quem define reconstruirVitrine.
   ===================================================================== */

const cfgVitrine = window.CONFIG_SUPABASE || {};
const bancoVitrine = (cfgVitrine.url && !cfgVitrine.url.startsWith('COLE_AQUI') && window.supabase)
    ? window.supabase.createClient(cfgVitrine.url, cfgVitrine.chavePublica)
    : null;


/* ---------------------------------------------------------------------
   Os exemplos, ditos com todas as letras

   Roda já, sem esperar o banco: se a consulta falhar, os exemplos ainda
   assim estarão marcados. O pior desfecho seria a rede cair e a página
   ficar mostrando seis casas inventadas sem nenhum aviso.
   --------------------------------------------------------------------- */
document.querySelectorAll('.anuncio[data-exemplo]').forEach(cartao => {
    // O "Ver vaga" do exemplo não leva a lugar nenhum, e link que não
    // funciona é lido como site quebrado — não como "isto é exemplo".
    // Sai da página em vez de ficar apagado.
    const ver = cartao.querySelector('.ver');
    if (ver) ver.remove();

    // Denunciar um anúncio que não existe também não faz sentido.
    const denunciar = cartao.querySelector('.denunciar');
    if (denunciar) denunciar.remove();

    const selo = cartao.querySelector('.selo-match');
    if (selo) {
        selo.classList.add('selo-exemplo');
        selo.textContent = 'Exemplo';
    }
});


/* ---------------------------------------------------------------------
   Buscar as repúblicas

   Uma consulta só, com as filhas embutidas. A regra de leitura do banco
   já esconde o que está fora do ar ou em revisão, mas o filtro vai
   escrito aqui também: sem ele o próprio dono veria o rascunho dele
   misturado na vitrine pública e acharia que todo mundo vê.
   --------------------------------------------------------------------- */
/* O site e o banco NUNCA sobem juntos.

   O site é arquivo estático no GitHub Pages; o banco é o Supabase, e
   uma migração roda quando alguém abre o SQL Editor e clica. Entre uma
   coisa e outra existe uma janela — minutos ou dias — em que a página
   nova pede colunas que o banco ainda não tem.

   E o PostgREST não devolve o que dá: pedir uma coluna inexistente
   derruba a consulta INTEIRA. Sem esta rede, publicar antes de rodar o
   SQL apagaria as repúblicas de verdade da home e deixaria só os seis
   exemplos, sem erro visível para quem estivesse olhando.

   Então: tenta com as colunas do destaque; se o banco disser que não as
   conhece, tenta de novo sem elas. A vitrine perde o selo dourado e
   continua sendo a vitrine.

   Isto não é gambiarra de migração: é uma propriedade permanente de
   servir HTML de um lugar e dados de outro. */
/* O "!faculdade_id" não é enfeite, e o comentário fica AQUI FORA porque
   o que está entre as crases viaja inteiro para o servidor: comentário
   dentro da string vira erro de sintaxe do PostgREST (PGRST100).

   Desde que republica_faculdades entrou na consulta existem DOIS
   caminhos de republicas até faculdades: a coluna antiga faculdade_id e
   a tabela nova. Sem dizer por qual, o PostgREST devolve 400 (PGRST201)
   e a vitrine inteira vem vazia — sem erro na tela, só sem casa. */
const CAMPOS_BASE = `
    id, nome, bairro, preco, caucao, minutos, modo, tipo, perfil, vagas,
    disponivel_em, lat, lng,
    cidades ( slug ),
    faculdades!faculdade_id ( sigla ),
    republica_faculdades ( minutos, faculdades ( sigla, lat, lng ) ),
    republica_fotos ( caminho, ordem ),
    republica_marcas ( marca ),
    republica_cursos ( curso )`;

const CAMPOS_COM_DESTAQUE = CAMPOS_BASE.replace(
    'disponivel_em,', 'disponivel_em, destaque, destaque_ate,');

async function buscarRepublicas() {
    if (!bancoVitrine) return;

    const consultar = campos => bancoVitrine
        .from('republicas')
        .select(campos)
        .eq('ativa', true)
        .eq('status', 'publicada')
        .order('criada_em', { ascending: false });

    let { data, error } = await consultar(CAMPOS_COM_DESTAQUE);

    // 42703 é "coluna não existe" no Postgres. Qualquer outro erro é
    // erro de verdade e segue o caminho de sempre.
    if (error && (error.code === '42703' || /destaque/.test(error.message || ''))) {
        console.warn('Banco ainda sem as colunas de destaque; seguindo sem elas.');
        ({ data, error } = await consultar(CAMPOS_BASE));
    }

    if (error) {
        // Sem estardalhaço na tela: os exemplos continuam lá e a página
        // segue de pé. O console fica com o motivo, para quem for
        // consertar.
        console.error('Falhou ao carregar as repúblicas:', error);
        return;
    }

    if (!data || !data.length) return;

    const vitrineEl = document.getElementById('vitrine');
    // Os cartões novos entram ANTES dos exemplos: assim, na cidade que
    // tem casa de verdade, o exemplo nem chega a ser considerado pelo
    // script.js — que já os esconde de qualquer jeito.
    data.slice().reverse().forEach(vaga => {
        vitrineEl.insertBefore(montarCartao(vaga), vitrineEl.firstChild);
    });

    // A vitrine mudou debaixo do script.js. Sem este aviso, ordemOriginal
    // continuaria só com os exemplos e as casas novas nunca entrariam
    // numa ficha nem no cálculo de compatibilidade.
    if (typeof window.reconstruirVitrine === 'function') window.reconstruirVitrine();
}


/* ---------------------------------------------------------------------
   Do banco para o cartão

   Os data-* daqui são o contrato com o script.js. Mudar um nome sem
   mudar lá quebra o filtro em silêncio: a casa some da ficha sem erro
   nenhum aparecer.
   --------------------------------------------------------------------- */
function montarCartao(vaga) {
    const marcas = (vaga.republica_marcas || []).map(m => m.marca).filter(Boolean);
    const cursos = (vaga.republica_cursos || []).map(c => c.curso).filter(Boolean);

    const cartao = document.createElement('article');
    cartao.className = 'anuncio';
    cartao.dataset.id = vaga.id;
    cartao.dataset.cidade = (vaga.cidades || {}).slug || '';
    cartao.dataset.cursos = cursos.join(',');
    cartao.dataset.preco = Number(vaga.preco);

    /* A coordenada da casa vai no cartão para o site poder medir a
       distância até uma faculdade que o anunciante NÃO marcou. Sem
       ela, "Perto da UNIFAL" só encontraria as casas cujo dono lembrou
       de marcar a UNIFAL — e quem procura não tem nada a ver com o que
       o dono marcou. */
    if (vaga.lat != null && vaga.lng != null) {
        cartao.dataset.lat = vaga.lat;
        cartao.dataset.lng = vaga.lng;
    }
    cartao.dataset.caucao = Number(vaga.caucao || 0);
    cartao.dataset.modo = vaga.modo || 'pe';

    /* AS FACULDADES DA CASA

       data-uni e data-min saem daqui como LISTAS paralelas, separadas
       por vírgula: a faculdade da posição 2 tem o tempo da posição 2.
       Mesmo formato de data-cursos e data-perfil, que já eram listas.

       Uma casa perto de uma faculdade só vira uma lista de um item, e
       por isso os cartões de exemplo escritos à mão no index.html
       continuam valendo sem mudar uma linha.

       999 é "não informou o tempo", a convenção que esta função já
       usava. O anunciante pode dizer "é perto" sem cravar o número. */
    const perto = (vaga.republica_faculdades || [])
        .filter(r => r && r.faculdades && r.faculdades.sigla);

    if (perto.length) {
        cartao.dataset.uni = perto.map(r => r.faculdades.sigla).join(',');
        cartao.dataset.min = perto.map(r => r.minutos == null ? 999 : r.minutos).join(',');

        /* A DISTÂNCIA MEDIDA, uma terceira lista na mesma ordem.

           Vazio onde não deu para medir: casa sem coordenada, ou
           faculdade sem coordenada. Quem lê trata o vazio caindo para
           o tempo declarado, que é o combinado — sumir da busca por
           falha nossa seria punir o anunciante. */
        cartao.dataset.km = perto
            .map(r => {
                const km = distanciaEmKm(vaga.lat, vaga.lng,
                                         r.faculdades.lat, r.faculdades.lng);
                return km == null ? '' : km.toFixed(2);
            })
            .join(',');
    } else {
        /* Vaga anterior ao 18-varias-faculdades.sql, ou banco que ainda
           não tem a tabela. A coluna antiga continua sendo escrita com
           a primeira faculdade, então ela serve de rede. */
        cartao.dataset.uni = (vaga.faculdades || {}).sigla || '';
        cartao.dataset.min = vaga.minutos || 999;
    }

    /* Estes quatro são só para o painel de "Filtros completos". Não
       aparecem em lugar nenhum da tela — existem para o filtro ter o que
       comparar sem voltar ao banco a cada clique. */
    cartao.dataset.tipo = vaga.tipo || '';
    cartao.dataset.bairro = vaga.bairro || '';
    cartao.dataset.vagas = vaga.vagas || 1;
    cartao.dataset.disponivel = vaga.disponivel_em || '';

    /* O destaque pago.

       data-peso é o que o script.js usa para desempatar a ordem, e ele
       vem de destaqueValendo() — que confere a DATA. Uma promoção que
       venceu ontem devolve peso 0 aqui mesmo que a coluna do banco
       ainda diga "premium", porque nada neste projeto depende de uma
       tarefa noturna ter rodado.

       A classe .destacado é só aparência: moldura e fundo. Quem decide
       posição é o peso, e ele nunca fura filtro — o filtro roda antes,
       no js/filtros.js. */
    const plano = destaqueValendo(vaga);
    cartao.dataset.destaque = plano || '';
    cartao.dataset.peso = pesoDoDestaque(vaga);
    if (plano) cartao.classList.add('destacado', 'destacado-' + plano);

    /* data-perfil junta o jeito da casa com as características, do mesmo
       jeito que os cartões de exemplo faziam ("silencioso,pet,mista").
       É o que a ficha "Aceita pet" e o cálculo do questionário leem. O
       'individual' entra a partir do tipo, porque no questionário a
       pessoa pede quarto individual e não um tipo de acomodação. */
    const perfil = [vaga.perfil, ...marcas];
    if (vaga.tipo === 'quarto_individual') perfil.push('individual');
    cartao.dataset.perfil = perfil.filter(Boolean).join(',');

    cartao.append(moldura(vaga), corpo(vaga, marcas));
    return cartao;
}


function moldura(vaga) {
    const caixa = document.createElement('div');
    caixa.className = 'anuncio-foto';

    const fotos = (vaga.republica_fotos || [])
        .slice()
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    if (fotos.length && fotos[0].caminho) {
        const img = document.createElement('img');
        img.src = fotos[0].caminho;
        img.alt = vaga.nome;
        img.loading = 'lazy';
        caixa.appendChild(img);
    } else {
        // Mesmo marcador dos exemplos: casa sem foto continua no ar,
        // porque casa sem foto é melhor que casa nenhuma — mas o quadro
        // diz a verdade em vez de fingir uma imagem.
        const aviso = document.createElement('small');
        aviso.textContent = 'Sem foto';
        caixa.appendChild(aviso);
    }

    const tipo = document.createElement('span');
    tipo.className = 'selo-tipo';
    tipo.textContent = NOME_DA_MARCA[vaga.perfil] || NOME_DA_MARCA[vaga.tipo] || '';
    caixa.appendChild(tipo);

    /* O selo do destaque, quando há um valendo. Vai embaixo do selo de
       tipo, no mesmo canto — e não em cima da nota de compatibilidade,
       que fica do outro lado e é a informação do estudante, não a do
       anunciante. Quem pagou ganha evidência; quem procura não perde
       de vista o que veio responder. */
    const destaque = seloDeDestaque(vaga);
    if (destaque) caixa.appendChild(destaque);

    // Fica em "—" até a pessoa responder o questionário. É o script.js
    // que preenche a nota depois, e ele procura por esta classe.
    const match = document.createElement('span');
    match.className = 'selo-match';
    match.textContent = '—';
    caixa.appendChild(match);

    caixa.appendChild(botaoDenunciar());
    return caixa;
}


function corpo(vaga, marcas) {
    const caixa = document.createElement('div');
    caixa.className = 'anuncio-corpo';

    const nome = document.createElement('h3');
    nome.textContent = vaga.nome;

    const onde = document.createElement('p');
    onde.className = 'anuncio-onde';
    const trajeto = (vaga.minutos && (vaga.faculdades || {}).sigla)
        ? `${vaga.minutos} min ${NOME_DO_MODO[vaga.modo] || 'a pé'} da ${vaga.faculdades.sigla}`
        : '';
    onde.textContent = [vaga.bairro, trajeto].filter(Boolean).join(' · ');

    // Três etiquetas e não as trinta: o cartão é a chamada, a página da
    // vaga é onde cabe a lista inteira.
    const mimos = document.createElement('div');
    mimos.className = 'mimos';
    marcas.filter(m => MARCAS_CONHECIDAS.has(m)).slice(0, 3).forEach(m => {
        const s = document.createElement('span');
        s.className = 'mimo';
        s.textContent = NOME_DA_MARCA[m];
        mimos.appendChild(s);
    });

    const pe = document.createElement('div');
    pe.className = 'anuncio-pe';

    const preco = document.createElement('div');
    preco.className = 'preco';
    preco.innerHTML = `R$ ${Number(vaga.preco)}<span> /mês</span>`;

    const ver = document.createElement('a');
    ver.className = 'ver';
    ver.href = `vaga.html?id=${vaga.id}`;
    ver.textContent = 'Ver vaga →';

    pe.append(preco, ver);
    caixa.append(nome, onde, mimos, pe);
    return caixa;
}


/* O mesmo botão dos cartões de exemplo, bandeirinha e tudo. O
   js/denuncia.js o encontra por delegação, então cartão criado agora
   funciona igual aos que já estavam na página. */
function botaoDenunciar() {
    const b = document.createElement('button');
    b.className = 'denunciar';
    b.type = 'button';
    b.title = 'Denunciar anúncio';
    b.setAttribute('aria-label', 'Denunciar este anúncio');
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4.5 21V4" />
          <path d="M4.5 5.2s1.9-1.4 4.8-1.4 3.9 1.4 6.7 1.4c1.4 0 2.2-.3 2.9-.6v8.7c-.7.3-1.5.6-2.9.6-2.8 0-3.8-1.4-6.7-1.4s-4.8 1.4-4.8 1.4" />
        </svg>`;
    return b;
}


/* ---------------------------------------------------------------------
   AS FACULDADES DE CADA CIDADE

   O questionário pergunta "onde você estuda?" e essa resposta é metade
   da nota de compatibilidade — é dela que sai o trajeto. Até aqui as
   opções estavam escritas à mão no js/script.js: UNIFAL, UNIFENAS e
   IFSULDEMINAS. Com Alfenas sendo o mundo inteiro, funcionava. Com Belo
   Horizonte na lista, perguntar a um estudante da UFMG se ele faz
   UNIFAL não é um detalhe de texto: é a pergunta central do site feita
   errado.

   Vem tudo de uma vez, e não uma consulta por cidade escolhida: são
   poucas dezenas de linhas, e o resto da página já funciona assim — a
   vitrine também carrega todas as repúblicas e filtra no navegador.
   Uma consulta a cada troca de cidade seria uma espera onde hoje não
   há nenhuma.

   Se a busca falhar, o objeto fica vazio e o questionário simplesmente
   pula a pergunta da faculdade. Perder uma pergunta é ruim; travar o
   questionário numa tela sem opção e sem botão seria pior.
   --------------------------------------------------------------------- */
window.FACULDADES_POR_CIDADE = {};
window.COORDENADA_DA_FACULDADE = {};

async function buscarFaculdades() {
    if (!bancoVitrine) return;

    const { data, error } = await bancoVitrine
        .from('faculdades')
        .select('sigla, lat, lng, cidades ( slug )')
        .order('sigla');

    if (error || !data) {
        console.error('Falhou ao carregar as faculdades:', error);
        return;
    }

    data.forEach(f => {
        const cidade = (f.cidades || {}).slug;
        if (!cidade || !f.sigla) return;

        (window.FACULDADES_POR_CIDADE[cidade] ||= []).push(f.sigla);

        /* A coordenada de cada faculdade fica à mão, por cidade e por
           sigla, e não numa lista só: "IFSULDEMINAS" existe em mais de
           uma cidade, e um mapa global pela sigla misturaria as duas.

           É isto que permite medir a distância de QUALQUER casa até
           QUALQUER faculdade da cidade — inclusive as que o anunciante
           não marcou no anúncio dele. */
        (window.COORDENADA_DA_FACULDADE[cidade] ||= {})[f.sigla] =
            { lat: f.lat, lng: f.lng };
    });

    /* Refaz a tela agora que se sabe as faculdades.

       Sem isto haveria uma janela de alguns décimos de segundo em que a
       pessoa poderia escolher a cidade antes da resposta do banco — e os
       cartões de exemplo ficariam vestindo a faculdade errada até ela
       mexer em outra coisa. Curta, mas é a primeira tela que ela vê. */
    if (typeof window.reconstruirVitrine === 'function') window.reconstruirVitrine();
}


buscarRepublicas();
buscarFaculdades();
