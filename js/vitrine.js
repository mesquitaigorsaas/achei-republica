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
async function buscarRepublicas() {
    if (!bancoVitrine) return;

    const { data, error } = await bancoVitrine
        .from('republicas')
        .select(`
            id, nome, bairro, preco, caucao, minutos, modo, tipo, perfil, vagas,
            cidades ( slug ),
            faculdades ( sigla ),
            republica_fotos ( caminho, ordem ),
            republica_marcas ( marca ),
            republica_cursos ( curso )
        `)
        .eq('ativa', true)
        .eq('status', 'publicada')
        .order('criada_em', { ascending: false });

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
    cartao.dataset.uni = (vaga.faculdades || {}).sigla || '';
    cartao.dataset.cursos = cursos.join(',');
    cartao.dataset.preco = Number(vaga.preco);
    cartao.dataset.caucao = Number(vaga.caucao || 0);
    cartao.dataset.min = vaga.minutos || 999;
    cartao.dataset.modo = vaga.modo || 'pe';

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


buscarRepublicas();
