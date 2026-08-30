/* =====================================================================
   Achei República — comportamento da página.
   ===================================================================== */

// Menu sanduíche.
const menuBotao = document.querySelector('.menu-botao');
const menu = document.getElementById('menu');

function fecharMenu() {
    menu.classList.remove('aberto');
    menuBotao.classList.remove('aberto');
    menuBotao.setAttribute('aria-expanded', 'false');
    menuBotao.setAttribute('aria-label', 'Abrir menu');
}

menuBotao.addEventListener('click', () => {
    const aberto = menu.classList.toggle('aberto');
    menuBotao.classList.toggle('aberto', aberto);
    menuBotao.setAttribute('aria-expanded', String(aberto));
    menuBotao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
});

// Escolheu um destino, a gaveta fecha — senão ela tapa a seção para
// onde a pessoa acabou de mandar rolar.
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', fecharMenu));
document.addEventListener('click', evento => {
    if (!menu.contains(evento.target) && !menuBotao.contains(evento.target)) fecharMenu();
});
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') fecharMenu();
});

// Fichas de ordenação: só uma ativa por vez.
const fichas = document.querySelectorAll('.ficha');
fichas.forEach(ficha => {
    ficha.addEventListener('click', () => {
        fichas.forEach(f => f.classList.remove('ativa'));
        ficha.classList.add('ativa');
    });
});

// Painel de filtros completos.
const abrirFiltros = document.getElementById('abrirFiltros');
const painelFiltros = document.getElementById('painelFiltros');

abrirFiltros.addEventListener('click', () => {
    const aberto = painelFiltros.classList.toggle('aberto');
    abrirFiltros.classList.toggle('aberto', aberto);
    abrirFiltros.setAttribute('aria-expanded', String(aberto));
    abrirFiltros.firstChild.textContent = aberto ? 'Fechar filtros ' : 'Filtros completos ';
});

document.getElementById('limparFiltros').addEventListener('click', () => {
    painelFiltros.querySelectorAll('input[type="checkbox"]').forEach(c => (c.checked = false));
    painelFiltros.querySelectorAll('input[type="number"], input[type="date"]').forEach(i => (i.value = ''));
    painelFiltros.querySelectorAll('select').forEach(s => (s.selectedIndex = 0));
});

// A rosca do match só se preenche quando o cartão entra na tela. Animar
// antes de a pessoa ver desperdiça o único momento em que o número
// chama atenção.
const nota = document.getElementById('notaMatch');
if (nota) {
    const porcento = parseInt(nota.querySelector('b').textContent, 10) || 0;
    new IntersectionObserver((entradas, observador) => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;
            nota.style.setProperty('--fatia', (porcento * 3.6) + 'deg');
            observador.disconnect();
        });
    }, { threshold: 0.4 }).observe(nota);
}

// A setinha aparece quando a primeira dobra sai de vista.
//
// Quem é observado é a dobra, e não o cabeçalho: o cabeçalho fica grudado
// no alto da tela e nunca sai de vista, então a conta nunca fecharia e a
// setinha ficaria acesa até no topo da página.
//
// Observador de interseção em vez do evento de rolagem porque ele acerta
// também quem abre link direto para uma seção e chega com a página já
// rolada, sem nenhum evento ter acontecido.
const subir = document.querySelector('.subir');
const dobra = document.querySelector('.heroi');

new IntersectionObserver(([entrada]) => {
    subir.classList.toggle('aparece', !entrada.isIntersecting);
}, { rootMargin: '-200px 0px 0px 0px' }).observe(dobra);
