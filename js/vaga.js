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
/* Qual vaga está aberta, e por onde a pessoa chegou. Guardado para o
   clique no WhatsApp poder contar com a mesma origem da visita — é o
   que permite dizer ao anunciante "dos 31 que abriram pelo filtro, 9 te
   chamaram". */
let vagaAberta = null;

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

    /* As duas colunas do destaque vão numa variável porque elas podem
       não existir ainda: o site sobe pelo GitHub Pages e o banco muda
       pelo SQL Editor, nunca ao mesmo tempo. E pedir coluna inexistente
       ao PostgREST derruba a consulta inteira — aqui isso significaria
       a página inteira da vaga virando "não achei". Mesma rede da
       vitrine, pelo mesmo motivo. */
    const campos = extra => `
        id, nome, bairro, descricao, tipo, perfil, preco, caucao,
        minutos, modo, vagas, disponivel_em, whatsapp, ativa, status,
        composicao, moradores, cep, logradouro, numero, complemento,
        lat, lng,${extra}
        cidades ( nome, slug ),
        faculdades!faculdade_id ( sigla, nome ),
        republica_faculdades ( minutos, faculdades ( sigla, nome, lat, lng ) ),
        republica_fotos ( caminho, ordem ),
        republica_marcas ( marca ),
        republica_cursos ( curso )`;

    const consultar = extra => bancoVaga
        .from('republicas')
        .select(campos(extra))
        .eq('id', id)
        .maybeSingle();

    let { data, error } = await consultar(' destaque, destaque_ate,');

    if (error && (error.code === '42703' || /destaque/.test(error.message || ''))) {
        console.warn('Banco ainda sem as colunas de destaque; seguindo sem elas.');
        ({ data, error } = await consultar(''));
    }

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

    /* Contar a visita.

       Só depois de desenhar: se a página não abriu, não houve visita a
       contar. E "direto" quando não há de onde ter vindo — o parâmetro
       ?de= é posto pelos cartões da vitrine, que sabem se a pessoa
       chegou por filtro, por questionário ou pela lista simples. */
    if (typeof window.registrarMetrica === 'function') {
        const de = new URLSearchParams(location.search).get('de');
        const origem = ['vitrine', 'filtro', 'match'].includes(de) ? de : 'direto';
        window.registrarMetrica(data.id, 'visita', origem);
        vagaAberta = { id: data.id, origem };
    }
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

    // O js/denuncia.js procura o alvo pelo [data-id] mais proximo. Sem
    // isto o botao de denunciar abriria a janela sem saber que anuncio
    // esta sendo denunciado.
    conteudo.dataset.id = vaga.id;

    const partes = [];

    partes.push(galeria(vaga));
    partes.push(cabecalho(vaga, cidade, faculdade));

    if (vaga.descricao) partes.push(bloco('Como é morar aí', paragrafos(vaga.descricao)));

    const quem = quemMora(vaga);
    if (quem) partes.push(quem);

    const marcas = (vaga.republica_marcas || [])
        .map(m => m.marca)
        // Marca antiga, de quando o apelido era outro, é ignorada em vez
        // de virar etiqueta em branco.
        .filter(m => MARCAS_CONHECIDAS.has(m));

    if (marcas.length) {
        partes.push(bloco('O que a casa tem',
            pilulas(marcas.map(m => [m, NOME_DA_MARCA[m]]))));
    }

    const onde = ondeFica(vaga, cidade);
    if (onde) partes.push(onde);

    partes.push(contato(vaga));
    partes.push(linkDenunciar());

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

    /* O selo de destaque vem primeiro na fileira, e diz o que é: um
       anúncio que o próprio anunciante destacou. Não diz "recomendado"
       nem "melhor opção" — nós não recomendamos ninguém por dinheiro, e
       escrever isso seria vender a palavra do site junto com o espaço. */
    const destaque = seloDeDestaque(vaga);
    if (destaque) selos.appendChild(destaque);

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

    /* UM QUADRINHO POR FACULDADE

       A casa pode estar perto de até três, e cada uma tem o tempo dela.
       Mostrar só a primeira escondia justamente o motivo de o estudante
       da segunda ter chegado nesta página.

       Sem tempo cravado o quadrinho ainda aparece, dizendo "perto":
       o dono pode não saber o número, e "perto da UFMG" é informação.

       A coluna antiga entra como rede, para vaga cadastrada antes do
       18-varias-faculdades.sql. */
    const pertoDe = (vaga.republica_faculdades || [])
        .filter(r => r && r.faculdades && r.faculdades.sigla);

    if (pertoDe.length) {
        /* O QUADRINHO PREFERE A DISTÂNCIA MEDIDA

           "1,2 km da UNIFENAS" é um número que o site calculou a partir
           das coordenadas. "10 min a pé" é o que o anunciante digitou, e
           ninguém conferiu — no único anúncio real do site, ele diz 10
           minutos e o Google responde 22.

           Então: quando dá para medir, aparece a distância. Quando não
           dá, aparece o tempo declarado, e a legenda diz de quem é o
           número. O botão de trajeto, logo abaixo, é quem responde
           "quantos minutos" de verdade. */
        pertoDe
            .map(r => ({
                r,
                km: distanciaEmKm(vaga.lat, vaga.lng, r.faculdades.lat, r.faculdades.lng)
            }))
            .sort((a, b) => {
                const pa = a.km !== null ? a.km
                    : (a.r.minutos == null ? 1e9 : a.r.minutos / 12);
                const pb = b.km !== null ? b.km
                    : (b.r.minutos == null ? 1e9 : b.r.minutos / 12);
                return pa - pb;
            })
            .forEach(({ r, km }) => {
                if (km !== null) {
                    numeros.appendChild(numero(kmEscrito(km), `até a ${r.faculdades.sigla}`));
                } else {
                    numeros.appendChild(numero(
                        r.minutos ? `${r.minutos} min` : 'Perto',
                        r.minutos
                            ? `da ${r.faculdades.sigla}, segundo o anunciante`
                            : `${NOME_DO_MODO[vaga.modo] || 'a pé'} da ${r.faculdades.sigla}`));
                }
            });
    } else if (vaga.minutos && faculdade) {
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
    h.textContent = 'Falar com o anunciante';

    const p = document.createElement('p');
    p.className = 'vaga-dica';
    p.textContent = 'A mensagem já vai escrita. Combine a visita antes de ir: '
        + 'casa de estudante raramente tem alguém em casa de manhã.';

    // Quem anuncia pode ser o dono, quem mora ou o responsável pela
    // casa — é o que a pessoa declara ao criar a conta. Prometer "quem
    // mora lá" seria errado em dois dos três casos.

    const texto = `Olá! Vi a vaga "${vaga.nome}" no Achei República. Ainda está disponível?`;
    const zap = document.createElement('a');
    zap.className = 'btn btn-azul';
    zap.href = `https://wa.me/55${vaga.whatsapp}?text=${encodeURIComponent(texto)}`;
    zap.target = '_blank';
    zap.rel = 'noopener';
    zap.textContent = 'Chamar no WhatsApp';

    /* O clique que vale dinheiro para o anunciante. Registrado no
       caminho, sem segurar o link: o WhatsApp abre na mesma hora, e a
       contagem viaja depois, em lote. Se a contagem falhar, a conversa
       acontece do mesmo jeito — que é a ordem certa de prioridades. */
    zap.addEventListener('click', () => {
        if (typeof window.registrarMetrica === 'function') {
            window.registrarMetrica(
                vaga.id, 'contato', (vagaAberta || {}).origem || 'direto');
        }
    });

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


/* ---------------------------------------------------------------------
   Quem mora na casa

   As duas perguntas que o estudante manda na primeira mensagem, agora
   respondidas antes dela: quem mora, e quantos. "Quero um quarto, mas
   não numa casa cheia de estudante" é um pedido real — e tem quem
   procure exatamente o contrário.

   Uma sem a outra não resolve: "só estudantes" pode ser dois ou nove, e
   a diferença entre dois e nove é a fila do banheiro de manhã.
   --------------------------------------------------------------------- */
function quemMora(vaga) {
    const cursos = (vaga.republica_cursos || []).map(c => c.curso).filter(Boolean);
    const temAlgo = vaga.composicao || vaga.moradores !== null || cursos.length;
    if (!temAlgo) return null;

    const corpo = document.createElement('div');

    const frases = [];

    if (vaga.composicao) frases.push(NOME_DA_MARCA[vaga.composicao]);

    if (vaga.moradores !== null && vaga.moradores !== undefined) {
        frases.push(vaga.moradores === 0
            ? 'A casa está vazia hoje'
            : `${vaga.moradores} morador${vaga.moradores > 1 ? 'es' : ''} hoje`);
    }

    if (frases.length) {
        const linha = document.createElement('p');
        linha.className = 'vaga-quem';
        linha.textContent = frases.join(' · ');
        corpo.appendChild(linha);
    }

    if (cursos.length) {
        const dica = document.createElement('p');
        dica.className = 'vaga-dica';
        dica.textContent = 'Cursos de quem mora aí. É o motivo de match mais forte '
            + 'da lista: quem estuda o mesmo que você já sabe o horário da prova.';
        corpo.append(dica, pilulas(cursos.map(c => [c, c])));
    }

    return bloco('Quem mora na casa', corpo);
}


/* ---------------------------------------------------------------------
   Onde fica

   "Centro" numa cidade pequena é meia cidade. Quem está escolhendo
   entre três casas precisa saber qual fica no caminho da faculdade.

   O mapa é o embed do Google montado pelo endereço escrito. Não usa
   chave de API de propósito: chave nenhuma cabe num site que é HTML
   servido pelo GitHub Pages — ela ficaria no código-fonte, à vista, e
   qualquer um poderia gastar a cota.
   --------------------------------------------------------------------- */
function ondeFica(vaga, cidade) {
    if (!vaga.logradouro && !vaga.bairro) return null;

    const rua = [vaga.logradouro, vaga.numero].filter(Boolean).join(', ');
    const busca = [rua, vaga.bairro, cidade.nome, 'MG', vaga.cep]
        .filter(Boolean).join(', ');

    const corpo = document.createElement('div');

    const linha = document.createElement('p');
    linha.className = 'vaga-endereco';
    linha.textContent = [rua, vaga.complemento, vaga.bairro, cidade.nome]
        .filter(Boolean).join(' · ');
    corpo.appendChild(linha);

    if (vaga.logradouro) {
        const mapa = document.createElement('iframe');
        mapa.className = 'vaga-mapa';
        mapa.src = 'https://www.google.com/maps?q=' + encodeURIComponent(busca) + '&output=embed';
        mapa.loading = 'lazy';
        mapa.title = 'Mapa de ' + busca;
        mapa.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
        mapa.setAttribute('allowfullscreen', '');
        corpo.appendChild(mapa);

        /* O link além do mapa embutido: quem está no celular quer abrir
           no aplicativo do Google Maps para traçar a rota, e o quadro
           embutido não faz isso. */
        const abrir = document.createElement('a');
        abrir.className = 'btn btn-linha vaga-mapa-link';
        abrir.href = 'https://www.google.com/maps/search/?api=1&query='
            + encodeURIComponent(busca);
        abrir.target = '_blank';
        abrir.rel = 'noopener';
        abrir.textContent = 'Abrir no Google Maps';
        corpo.appendChild(abrir);

        /* O TRAJETO ATÉ CADA FACULDADE

           Um link por faculdade, e o Maps abre com a rota a pé já
           traçada: sai daqui, chega lá, quantos minutos são de verdade.

           Isto existe porque o tempo que aparece nos quadrinhos lá em
           cima é DECLARADO pelo anunciante, e ninguém confere. Quem tem
           pressa de alugar pode escrever 10 onde são 20. O link entrega
           a conferência a quem mais precisa dela — o estudante, antes de
           atravessar a cidade para ver o quarto.

           Abrir o Maps não custa nada. Perguntar ao Google, pelo código,
           quanto tempo leva o trajeto é uma API cobrada por consulta, e
           é por isso que a resposta aparece no aplicativo dele e não
           nesta página.

           O destino é o nome da faculdade mais a cidade. O dia em que a
           tabela faculdades tiver endereço ou coordenada — as colunas
           lat e lng estão lá desde o 01-esquema.sql, vazias — este
           trecho passa a usar a coordenada e para de depender de o
           Google adivinhar o nome. */
        const pertoDe = (vaga.republica_faculdades || [])
            .filter(r => r && r.faculdades && r.faculdades.sigla);

        const trilha = document.createElement('div');
        trilha.className = 'vaga-trajetos';
        if (pertoDe.length) corpo.appendChild(trilha);

        pertoDe.forEach(r => {
            const destino = [r.faculdades.nome || r.faculdades.sigla, cidade.nome, 'MG']
                .filter(Boolean).join(', ');

            const rota = document.createElement('a');
            rota.className = 'btn btn-linha vaga-mapa-link';
            rota.href = 'https://www.google.com/maps/dir/?api=1'
                + '&origin=' + encodeURIComponent(busca)
                + '&destination=' + encodeURIComponent(destino)
                + '&travelmode=walking';
            rota.target = '_blank';
            rota.rel = 'noopener';
            rota.textContent = `Trajeto até a ${r.faculdades.sigla}`;
            trilha.appendChild(rota);
        });
    }

    return bloco('Onde fica', corpo);
}


/* O caminho da denúncia, em palavras e no fim da página — depois de a
   pessoa ter visto as fotos, o preço e o texto, que é quando ela
   reconhece o anúncio que já viu em outros três sites.

   A classe "denunciar" é o que o js/denuncia.js escuta; a segunda
   desfaz o desenho de bandeirinha flutuante que ele tem no cartão da
   vitrine, onde não há espaço para uma frase. */
function linkDenunciar() {
    const caixa = document.createElement('p');
    caixa.className = 'vaga-denuncia';

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'denunciar denunciar-linha';
    b.textContent = 'Esse anúncio parece de imobiliária ou corretor? Denunciar';

    caixa.appendChild(b);
    return caixa;
}
