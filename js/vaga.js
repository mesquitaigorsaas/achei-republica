/* =====================================================================
   Achei República — a página de uma vaga

   O cartão da busca cabe uma foto e três etiquetas. Uma casa não cabe
   nisso: quem vai morar num lugar quer ver o banheiro, saber se a
   cozinha é dividida, quanto tempo dá até a faculdade e o que os
   moradores estudam.

   Existe também por um motivo mais simples: endereço próprio. Vaga boa
   é mandada no grupo do WhatsApp do curso, e não dá para mandar "abre o
   site, escolhe Alfenas, rola até a terceira".
   ===================================================================== */

const cfgVaga = window.CONFIG_SUPABASE || {};
const bancoVaga = (cfgVaga.url && !cfgVaga.url.startsWith('COLE_AQUI') && window.supabase)
    ? window.supabase.createClient(cfgVaga.url, cfgVaga.chavePublica)
    : null;


/* ---------------------------------------------------------------------
   Menu sanduíche

   Mesmo pedaço do classificados.js: abaixo de 1030px o style.css
   esconde o menu e passa a bola para o botão. O script.js da home
   faria isso, mas ele também mexe no questionário e nas fichas, que
   não existem aqui.
   --------------------------------------------------------------------- */
const botaoDoMenu = document.querySelector('.menu-botao');
const oMenu = document.getElementById('menu');

if (botaoDoMenu && oMenu) {
    botaoDoMenu.addEventListener('click', () => {
        const aberto = oMenu.classList.toggle('aberto');
        botaoDoMenu.classList.toggle('aberto', aberto);
        botaoDoMenu.setAttribute('aria-expanded', String(aberto));
        botaoDoMenu.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    });
}


const carregando = document.getElementById('carregando');
const naoAchei = document.getElementById('naoAchei');
const conteudo = document.getElementById('conteudo');


function naoEncontrada(titulo, texto) {
    carregando.hidden = true;
    naoAchei.hidden = false;
    if (titulo) document.getElementById('naoAcheiTitulo').textContent = titulo;
    if (texto)  document.getElementById('naoAcheiTexto').textContent = texto;
}


/* ---------------------------------------------------------------------
   Buscar

   Uma consulta só, com as tabelas filhas embutidas. Cinco consultas
   separadas dariam o mesmo resultado e cinco idas ao servidor — numa
   internet de cidade pequena isso é a diferença entre abrir e desistir.
   --------------------------------------------------------------------- */
async function carregar() {
    const id = new URLSearchParams(location.search).get('id');

    if (!bancoVaga) {
        return naoEncontrada('O site ainda não está ligado ao banco',
            'Confira o js/supabase-config.js.');
    }

    if (!id) {
        return naoEncontrada('Faltou dizer qual vaga',
            'O endereço veio sem o identificador da vaga.');
    }

    const { data, error } = await bancoVaga
        .from('republicas')
        .select(`
            id, nome, bairro, descricao, tipo, perfil, preco, caucao,
            minutos, modo, vagas, disponivel_em, whatsapp, ativa, status,
            cidades ( nome, slug ),
            faculdades ( sigla, nome ),
            republica_fotos ( caminho, ordem ),
            republica_marcas ( marca ),
            republica_cursos ( curso )
        `)
        .eq('id', id)
        .maybeSingle();

    /* Erro de consulta NÃO é vaga inexistente, e tratar os dois igual
       esconde problema de verdade atrás de "não achei". */
    if (error) {
        console.error('Falhou ao abrir a vaga:', error);
        return naoEncontrada('Não consegui abrir essa vaga',
            'Tente recarregar a página. Se continuar: ' + error.message);
    }

    /* A regra de leitura do banco já devolve nada quando a vaga está
       fora do ar ou em revisão — e devolve para o dono, que precisa
       enxergar a própria. Então "sem linha" aqui quer dizer mesmo que
       não há o que mostrar para quem está olhando. */
    if (!data) return naoEncontrada();

    desenhar(data);
}


/* ---------------------------------------------------------------------
   Desenhar
   --------------------------------------------------------------------- */
function desenhar(vaga) {
    const cidade = vaga.cidades || {};
    const faculdade = vaga.faculdades || null;

    document.title = `${vaga.nome} — ${cidade.nome || 'Achei República'}`;

    // A volta leva a cidade junto, como em todas as outras páginas.
    document.getElementById('voltarBusca').href =
        cidade.slug ? `index.html?cidade=${cidade.slug}#republicas` : 'index.html#cidade';

    const partes = [];

    partes.push(galeria(vaga));
    partes.push(cabecalho(vaga, cidade, faculdade));

    if (vaga.descricao) partes.push(bloco('Como é morar aí', paragrafos(vaga.descricao)));

    const cursos = (vaga.republica_cursos || []).map(c => c.curso).filter(Boolean);
    if (cursos.length) {
        partes.push(bloco('Quem mora aí estuda',
            pilulas(cursos.map(c => [c, c])),
            'É o motivo de match mais forte da lista: quem estuda o mesmo '
            + 'que você já sabe o horário da prova e a fila do RU.'));
    }

    const marcas = (vaga.republica_marcas || [])
        .map(m => m.marca)
        // Marca antiga, de quando o apelido era outro, é ignorada em vez
        // de virar etiqueta em branco.
        .filter(m => MARCAS_CONHECIDAS.has(m));

    if (marcas.length) {
        partes.push(bloco('O que a casa tem',
            pilulas(marcas.map(m => [m, NOME_DA_MARCA[m]]))));
    }

    partes.push(contato(vaga));

    conteudo.replaceChildren(...partes);
    carregando.hidden = true;
    conteudo.hidden = false;
}


/* A galeria. A primeira foto é a capa — a mesma que aparece no cartão
   da busca — e as outras viram miniaturas que trocam a grande. */
function galeria(vaga) {
    const fotos = (vaga.republica_fotos || [])
        .slice()
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(f => f.caminho)
        .filter(Boolean);

    const caixa = document.createElement('div');
    caixa.className = 'vaga-galeria';

    // Sem foto, um quadro com o tipo da acomodação em vez de um buraco
    // cinza — e uma frase honesta, porque casa sem foto é casa que a
    // pessoa vai perguntar sobre foto na primeira mensagem.
    if (!fotos.length) {
        caixa.classList.add('sem-foto');
        const aviso = document.createElement('p');
        aviso.textContent = 'Esta vaga ainda não tem foto.';
        caixa.appendChild(aviso);
        return caixa;
    }

    const grande = document.createElement('img');
    grande.className = 'vaga-foto-grande';
    grande.src = fotos[0];
    grande.alt = vaga.nome;
    caixa.appendChild(grande);

    if (fotos.length > 1) {
        const tiras = document.createElement('div');
        tiras.className = 'vaga-miniaturas';

        fotos.forEach((url, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'vaga-mini' + (i === 0 ? ' ativa' : '');
            b.setAttribute('aria-label', `Ver a foto ${i + 1} de ${fotos.length}`);

            const img = document.createElement('img');
            img.src = url;
            img.alt = '';
            img.loading = 'lazy';
            b.appendChild(img);

            b.addEventListener('click', () => {
                grande.src = url;
                tiras.querySelectorAll('.vaga-mini').forEach(o => o.classList.remove('ativa'));
                b.classList.add('ativa');
            });

            tiras.appendChild(b);
        });

        caixa.appendChild(tiras);
    }

    return caixa;
}


function cabecalho(vaga, cidade, faculdade) {
    const caixa = document.createElement('header');
    caixa.className = 'vaga-cabeca';

    const titulo = document.createElement('h1');
    titulo.textContent = vaga.nome;

    const onde = document.createElement('p');
    onde.className = 'vaga-onde';
    onde.textContent = [vaga.bairro, cidade.nome].filter(Boolean).join(' · ');

    // As etiquetas do topo: o que a pessoa checa em dois segundos antes
    // de decidir se lê o resto.
    const selos = document.createElement('div');
    selos.className = 'vaga-selos';
    [
        NOME_DA_MARCA[vaga.tipo],
        NOME_DA_MARCA[vaga.perfil],
        vaga.vagas > 1 ? `${vaga.vagas} vagas` : '1 vaga',
    ].filter(Boolean).forEach(texto => {
        const s = document.createElement('span');
        s.className = 'vaga-selo';
        s.textContent = texto;
        selos.appendChild(s);
    });

    const numeros = document.createElement('div');
    numeros.className = 'vaga-numeros';

    numeros.appendChild(numero(`R$ ${Number(vaga.preco)}`, 'por mês'));

    numeros.appendChild(Number(vaga.caucao) > 0
        ? numero(`R$ ${Number(vaga.caucao)}`, 'de caução')
        : numero('Sem caução', 'nada adiantado'));

    if (vaga.minutos && faculdade) {
        numeros.appendChild(numero(
            `${vaga.minutos} min`,
            `${NOME_DO_MODO[vaga.modo] || 'a pé'} da ${faculdade.sigla}`));
    }

    if (vaga.disponivel_em) {
        numeros.appendChild(numero(dataCurta(vaga.disponivel_em), 'a partir de'));
    }

    caixa.append(titulo, onde, selos, numeros);
    return caixa;
}


function numero(grande, pequeno) {
    const caixa = document.createElement('div');
    caixa.className = 'vaga-numero';

    const b = document.createElement('b');
    b.textContent = grande;

    const s = document.createElement('small');
    s.textContent = pequeno;

    caixa.append(b, s);
    return caixa;
}


function bloco(titulo, corpo, dica) {
    const caixa = document.createElement('section');
    caixa.className = 'vaga-bloco';

    const h = document.createElement('h2');
    h.textContent = titulo;
    caixa.appendChild(h);

    if (dica) {
        const p = document.createElement('p');
        p.className = 'vaga-dica';
        p.textContent = dica;
        caixa.appendChild(p);
    }

    caixa.appendChild(corpo);
    return caixa;
}


/* O texto do anunciante vira parágrafos de verdade. Jogado num
   textContent só, uma descrição de oito linhas com quebras viraria um
   bloco único que ninguém lê até o fim. */
function paragrafos(texto) {
    const caixa = document.createElement('div');
    caixa.className = 'vaga-texto';
    texto.split(/\n{1,}/).map(t => t.trim()).filter(Boolean).forEach(t => {
        const p = document.createElement('p');
        p.textContent = t;
        caixa.appendChild(p);
    });
    return caixa;
}


/* As mesmas pílulas do cadastro e dos filtros. Quem cadastrou marcando
   "Aceita pet" reconhece a etiqueta aqui, no mesmo desenho. */
function pilulas(pares) {
    const caixa = document.createElement('div');
    caixa.className = 'vaga-pilulas';
    pares.forEach(([, nome]) => {
        const s = document.createElement('span');
        s.className = 'vaga-pilula';
        s.textContent = nome;
        caixa.appendChild(s);
    });
    return caixa;
}


/* O contato. Se não há WhatsApp gravado, o botão NÃO é desenhado: um
   botão que não faz nada não é lido como "esta vaga não tem telefone",
   é lido como site quebrado. */
function contato(vaga) {
    const caixa = document.createElement('section');
    caixa.className = 'vaga-contato';

    if (!vaga.whatsapp) {
        const p = document.createElement('p');
        p.className = 'vaga-dica';
        p.textContent = 'Esta vaga foi cadastrada sem telefone de contato.';
        caixa.appendChild(p);
        return caixa;
    }

    const h = document.createElement('h2');
    h.textContent = 'Falar com quem mora lá';

    const p = document.createElement('p');
    p.className = 'vaga-dica';
    p.textContent = 'A mensagem já vai escrita. Combine a visita antes de ir: '
        + 'casa de estudante raramente tem alguém em casa de manhã.';

    const texto = `Olá! Vi a vaga "${vaga.nome}" no Achei República. Ainda está disponível?`;
    const zap = document.createElement('a');
    zap.className = 'btn btn-azul';
    zap.href = `https://wa.me/55${vaga.whatsapp}?text=${encodeURIComponent(texto)}`;
    zap.target = '_blank';
    zap.rel = 'noopener';
    zap.textContent = 'Chamar no WhatsApp';

    caixa.append(h, p, zap);
    return caixa;
}


function dataCurta(iso) {
    // O banco devolve 2026-02-01. Montar com new Date(iso) puxaria o
    // fuso e mostraria 31 de janeiro para quem está no Brasil.
    const [ano, mes, dia] = String(iso).split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                   'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${Number(dia)} de ${meses[Number(mes) - 1]}`;
}


carregar();
