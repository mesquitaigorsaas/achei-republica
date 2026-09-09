/* =====================================================================
   Achei República — os "Filtros completos"

   Este painel existia desde o começo e nunca filtrou nada. Eram
   cinquenta caixinhas sem value, sem id e sem ninguém escutando: a
   pessoa marcava "aceita pet", clicava em "Aplicar filtros" e a lista
   continuava exatamente igual.

   Botão que não faz nada não é lido como "essa parte ainda não existe".
   É lido como site quebrado, e a desconfiança não fica no botão —
   contamina o preço, a foto e o anúncio inteiro.

   As caixinhas agora saem do js/marcas.js, o mesmo arquivo que o
   cadastro usa para gravar. É o que garante que "aceita pet" aqui
   procure exatamente o apelido que o anunciante marcou lá. Escritas em
   dois lugares, bastava um acento de diferença para o filtro devolver
   lista vazia sem erro nenhum na tela.

   Carregado depois do script.js, de quem usa aplicarFicha().
   ===================================================================== */

const painelFiltrosEl = document.getElementById('painelFiltros');

if (painelFiltrosEl && typeof MARCAS !== 'undefined') {

    /* -----------------------------------------------------------------
       As caixinhas
       ----------------------------------------------------------------- */
    function pilulas(caixa, pares, grupo) {
        if (!caixa) return;
        caixa.replaceChildren(...pares.map(([apelido, nome]) => {
            const item = document.createElement('label');
            item.className = 'marca-item';

            const entrada = document.createElement('input');
            entrada.type = 'checkbox';
            entrada.value = apelido;
            entrada.dataset.filtro = grupo;

            const texto = document.createElement('span');
            texto.textContent = nome;

            item.append(entrada, texto);
            return item;
        }));
    }

    const grupoDeMarcas = titulo =>
        (MARCAS.find(g => g.grupo === titulo) || { itens: [] }).itens;

    pilulas(document.getElementById('fTipos'), TIPOS, 'tipo');

    // "Sem caução" não é característica: é a coluna caucao valendo zero.
    // Fica junto das outras duas porque, para quem procura, as três são
    // a mesma pergunta — o que eu não vou pagar.
    pilulas(document.getElementById('fTaxas'),
        [['sem-caucao', 'Sem caução'], ...grupoDeMarcas('Taxas')], 'marca');

    pilulas(document.getElementById('fIncluso'),
        grupoDeMarcas('Já vem incluso no aluguel'), 'marca');

    pilulas(document.getElementById('fEstrutura'),
        grupoDeMarcas('Estrutura'), 'marca');

    // O jeito da casa mistura duas coisas no banco: o perfil, que é
    // coluna, e o ambiente, que é característica. Para quem procura é
    // uma pergunta só, e o cartão guarda as duas no mesmo data-perfil.
    pilulas(document.getElementById('fJeito'),
        [...PERFIS, ...grupoDeMarcas('Ambiente')], 'marca');

    pilulas(document.getElementById('fRegras'),
        grupoDeMarcas('Regras da casa'), 'marca');


    /* -----------------------------------------------------------------
       Os seletores

       "Como você vai" e "Tempo máximo" não tinham opção neutra: abriam
       já em "A pé" e "Até 5 min". Aplicados assim, o painel cortaria a
       lista inteira sem a pessoa ter pedido nada.
       ----------------------------------------------------------------- */
    const selBairro = document.getElementById('fBairro');
    const selUni = document.getElementById('fUni');
    const selComo = document.getElementById('fComo');
    const selTempo = document.getElementById('fTempo');

    /* Os dois vêm do HTML com texto e sem value — "A pé", "Até 5 min".
       Comparar isso com o data-modo do cartão, que guarda 'pe', nunca
       casaria; e parseInt('Até 5 min') dá NaN. Refeitos aqui, com valor
       de verdade e a opção neutra na frente. */
    function refazer(sel, neutro, pares) {
        if (!sel) return;
        sel.replaceChildren();
        [['', neutro], ...pares].forEach(([valor, rotulo]) => {
            const o = document.createElement('option');
            o.value = valor;
            o.textContent = rotulo;
            sel.appendChild(o);
        });
        sel.value = '';
    }

    refazer(selComo, 'Tanto faz',
        MODOS.map(([apelido, nome]) => [apelido, nome.charAt(0).toUpperCase() + nome.slice(1)]));

    /* Era "até X minutos", e o minuto vinha do que o anunciante
       digitou. Agora é distância, que o site mede: um quilômetro a pé e
       um quilômetro de bike são o mesmo quilômetro. */
    refazer(selTempo, 'Qualquer distância',
        [1, 2, 3, 5, 10].map(k => [String(k), 'Até ' + k + ' km']));

    /* Bairro e faculdade saem dos anúncios que existem, e não de uma
       lista fixa. A lista escrita à mão era de Alfenas: em Varginha ela
       ofereceria bairros que não existem lá, e filtrar por um deles
       devolveria vazio sempre. */
    function montarDosAnuncios(sel, atributo, rotuloVazio) {
        if (!sel) return;

        const escolhido = sel.value;
        const slug = document.getElementById('selCidade').value;

        /* O bairro sai dos anúncios: bairro que não tem casa nenhuma é
           filtro que devolve lista vazia.

           A FACULDADE sai do banco, e não dos anúncios. São coisas
           diferentes: bairro é onde as casas estão, faculdade é de onde
           a pessoa mede a distância — e ela pode querer medir a partir
           de uma faculdade que nenhum anunciante marcou. Foi assim que
           a UNIFAL sumiu do site em Alfenas: um anúncio só, marcado na
           UNIFENAS, e quem estuda na UNIFAL não se encontrava. */
        const valores = atributo === 'uni'
            ? ((window.FACULDADES_POR_CIDADE || {})[slug] || []).slice()
            : [...document.querySelectorAll('.anuncio')]
                .filter(c => !c.dataset.exemplo && c.dataset.cidade === slug)
                .map(c => (c.dataset[atributo] || '').trim())
                .filter(Boolean);

        const unicos = [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        sel.replaceChildren();

        const vazia = document.createElement('option');
        vazia.value = '';
        vazia.textContent = rotuloVazio;
        sel.appendChild(vazia);

        unicos.forEach(v => {
            const o = document.createElement('option');
            o.value = v;
            o.textContent = v;
            sel.appendChild(o);
        });

        sel.value = unicos.includes(escolhido) ? escolhido : '';
        // Sem nada para escolher, o campo some em vez de virar um
        // seletor de uma opção só.
        sel.closest('.campo').hidden = unicos.length === 0;
    }


    /* Montados já na carga, e não só quando o painel abre.

       Isto foi um bug de verdade. Os dois vinham do HTML como
       <option>Todos</option>, sem value — e num <select> assim, .value
       devolve o próprio texto. O filtro então comparava o bairro de cada
       casa com a palavra "Todos", nenhuma batia, e a lista vinha vazia.

       Pior: só acontecia até alguém clicar em "Limpar tudo", que zera os
       dois. Quem filtrasse de primeira via lista vazia; quem limpasse
       antes via a lista certa. */
    montarDosAnuncios(selBairro, 'bairro', 'Todos');
    montarDosAnuncios(selUni, 'uni', 'Todas');


    /* -----------------------------------------------------------------
       A pergunta que o painel faz de cada cartão

       O script.js chama isto depois de aplicar a ficha. Devolver true
       quer dizer "esta casa passa"; qualquer critério que falhe corta.
       ----------------------------------------------------------------- */
    const marcados = grupo =>
        [...painelFiltrosEl.querySelectorAll(`input[data-filtro="${grupo}"]:checked`)]
            .map(c => c.value);

    /* Alguém mexeu em alguma coisa aqui dentro?

       O script.js usa isto para saber se a pessoa está na vitrine crua
       ou já disse o que quer. Os selects têm value vazio na opção
       "Todos"/"Todas" (veja o aviso do montarDosAnuncios acima), então
       value preenchido é escolha de verdade. */
    window.painelTemFiltro = function () {
        if (painelFiltrosEl.querySelector('input[type="checkbox"]:checked')) return true;
        return [...painelFiltrosEl.querySelectorAll('select, input[type="number"], input[type="date"]')]
            .some(campo => campo.value);
    };

    window.passaNoPainel = function (cartao) {
        // Exemplo não é casa de verdade: filtrar um anúncio que ninguém
        // pode visitar só faria a lista sumir sem motivo.
        if (cartao.dataset.exemplo) return true;

        const tem = (cartao.dataset.perfil || '').split(',');

        const tipos = marcados('tipo');
        if (tipos.length && !tipos.includes(cartao.dataset.tipo)) return false;

        /* E, e não OU: quem marca "aceita pet" e "internet" quer as duas
           coisas. Com OU, marcar mais caixinhas aumentaria a lista — o
           contrário do que a pessoa está tentando fazer. */
        for (const marca of marcados('marca')) {
            if (marca === 'sem-caucao') {
                if (Number(cartao.dataset.caucao) !== 0) return false;
            } else if (!tem.includes(marca)) {
                return false;
            }
        }

        if (selBairro && selBairro.value && cartao.dataset.bairro !== selBairro.value) return false;
        /* A faculdade deixou de EXCLUIR e virou o ponto de partida da
           medida — é o que o rótulo "Distância a partir de" diz.

           Antes ela cortava as casas cujo dono não tivesse marcado
           aquela faculdade, e isso escondia casa a 900 metros só porque
           o anunciante marcou outra. O que o dono marcou não diz nada
           sobre onde a casa fica; a coordenada diz.

           Quem quer cortar por proximidade usa o campo de distância
           logo abaixo, que agora mede a partir daqui. */

        if (selComo && selComo.value && cartao.dataset.modo !== selComo.value) return false;

        /* O teto de distância vale para a faculdade escolhida ali em
           cima. Sem faculdade escolhida vale a mais perto — senão "até
           2 km" recusaria uma casa a 800 m da UFMG só porque ela também
           fica a 5 km da PUC.

           Casa sem coordenada entra pelo tempo declarado, convertido:
           é o combinado de não punir o anunciante por falha nossa. */
        if (selTempo && selTempo.value) {
            const teto = Number(selTempo.value);
            const km = distanciaPara(cartao, selUni && selUni.value);
            if (Number.isFinite(teto) && km > teto) return false;
        }

        const minimo = Number(document.getElementById('fMin').value);
        const maximo = Number(document.getElementById('fMax').value);
        const preco = Number(cartao.dataset.preco);
        if (minimo > 0 && preco < minimo) return false;
        if (maximo > 0 && preco > maximo) return false;

        const vagas = Number(document.getElementById('fVagas').value);
        if (vagas > 0 && Number(cartao.dataset.vagas || 1) < vagas) return false;

        /* A data é "quero entrar até aí". Casa sem data informada passa:
           não saber quando libera não é o mesmo que liberar tarde, e
           cortá-la esconderia anúncio bom por um campo em branco. */
        const ate = document.getElementById('fData').value;
        if (ate && cartao.dataset.disponivel && cartao.dataset.disponivel > ate) return false;

        return true;
    };


    /* -----------------------------------------------------------------
       Aplicar e limpar
       ----------------------------------------------------------------- */
    const conta = document.getElementById('painelConta');

    function aplicar() {
        aplicarFicha();

        const quantas = [...document.querySelectorAll('.anuncio')].filter(c => !c.hidden).length;

        conta.hidden = false;
        conta.textContent = quantas === 0
            ? 'Nenhuma república com esses filtros. Tire alguma marcação para ver mais.'
            : quantas === 1
                ? '1 república com esses filtros.'
                : `${quantas} repúblicas com esses filtros.`;
    }

    document.getElementById('aplicarFiltros').addEventListener('click', aplicar);

    document.getElementById('limparFiltros').addEventListener('click', () => {
        painelFiltrosEl.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = false; });
        painelFiltrosEl.querySelectorAll('input[type="number"], input[type="date"]')
            .forEach(c => { c.value = ''; });
        [selBairro, selUni, selComo, selTempo].forEach(s => { if (s) s.value = ''; });

        conta.hidden = true;
        aplicarFicha();
    });

    /* Trocar de cidade zera o painel. Manter "Vila Rica" marcado de
       Alfenas ao abrir Varginha faria a nova cidade parecer vazia. */
    document.getElementById('selCidade').addEventListener('change', () => {
        document.getElementById('limparFiltros').click();
    });

    /* Os seletores de bairro e faculdade se refazem toda vez que o
       painel abre: as casas podem ter chegado do banco depois da carga. */
    document.getElementById('abrirFiltros').addEventListener('click', () => {
        montarDosAnuncios(selBairro, 'bairro', 'Todos');
        montarDosAnuncios(selUni, 'uni', 'Todas');
    });
}
