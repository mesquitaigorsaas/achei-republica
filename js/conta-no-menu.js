/* =====================================================================
   Achei República — o "Entrar" do menu

   As páginas públicas — home, classificados, página da vaga e planos —
   não tinham porta de entrada nenhuma. Quem já tinha conta só chegava
   ao painel por dentro do "Anunciar vaga", e quem estava logado não
   tinha como sair de lugar nenhum.

   ---------------------------------------------------------------------
   POR QUE ELE TROCA DE NOME

   Um "Entrar" mostrado a quem já entrou não é só inútil: é a mesma
   armadilha do botão que não faz nada. A pessoa clica, cai numa tela de
   login que a reconhece e a devolve, e fica sem saber se está logada ou
   não. Então o link lê a sessão e vira "Sair".

   Enquanto a resposta do banco não chega, ele não aparece. Meio segundo
   de nada é melhor do que meio segundo dizendo "Entrar" para quem já
   está dentro — e depois se corrigindo na cara da pessoa.

   ---------------------------------------------------------------------
   POR QUE UM IIFE

   Entra em quatro páginas que já carregam outros scripts, e nomes como
   "banco", "menu" e "usuario" estão todos tomados. Um const repetido no
   escopo global não avisa nada: derruba a página inteira.
   ===================================================================== */

(function () {

const link = document.querySelector('[data-conta]');
if (!link) return;

const cfg = window.CONFIG_SUPABASE || {};
const bancoMenu = (cfg.url && !cfg.url.startsWith('COLE_AQUI') && window.supabase)
    ? window.supabase.createClient(cfg.url, cfg.chavePublica)
    : null;

/* Sem banco não há como saber quem é. O link fica como está no HTML —
   "Entrar", apontando para o login — que é o palpite certo para quem
   não conseguimos identificar. */
if (!bancoMenu) return;

/* O caminho até a pasta auth/ muda conforme a página que carrega isto.
   Sai do próprio href escrito no HTML, em vez de ser adivinhado aqui:
   assim uma página nova em subpasta não quebra em silêncio. */
const paraOLogin = link.getAttribute('href');

link.hidden = true;

function comoEntrar() {
    link.textContent = 'Entrar';
    link.setAttribute('href', paraOLogin);
    link.hidden = false;
}

function comoSair() {
    link.textContent = 'Sair';
    /* Continua sendo um link de verdade, e não um href="#": sem
       JavaScript ele ao menos leva a uma tela que sabe explicar o que
       fazer, em vez de não fazer nada no clique. */
    link.setAttribute('href', paraOLogin);
    link.hidden = false;
}

link.addEventListener('click', async evento => {
    if (link.textContent !== 'Sair') return;

    evento.preventDefault();
    link.textContent = 'Saindo...';
    await bancoMenu.auth.signOut();

    /* Recarrega em vez de só trocar o rótulo: metade das páginas mostra
       coisa diferente para quem está logado, e deixar a tela antiga no
       ar depois de sair é como não ter saído. */
    location.reload();
});

bancoMenu.auth.getSession().then(({ data }) => {
    if (data && data.session) comoSair();
    else comoEntrar();
}, () => comoEntrar());

/* Entrou ou saiu em outra aba: as duas abas contam a mesma história. */
bancoMenu.auth.onAuthStateChange((_evento, sessao) => {
    if (sessao) comoSair();
    else comoEntrar();
});

})();
