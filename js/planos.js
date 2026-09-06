/* =====================================================================
   Achei República — os planos, ditos uma vez só

   Cinco páginas precisam saber o que é um "premium": a vitrine desenha
   o selo, a página da vaga desenha o selo, o painel diz quantos dias
   faltam, a tela de planos vende, e a administração confere. Escrito em
   cinco lugares, bastava um emoji diferente para o mesmo plano virar
   duas coisas na cabeça de quem usa.

   É o mesmo remédio do js/marcas.js, e pelo mesmo motivo: o filtro de
   "aceita pet" já quebrou uma vez porque o apelido estava escrito em
   dois arquivos.

   ---------------------------------------------------------------------
   ATENÇÃO AO QUE ESTE ARQUIVO NÃO TEM

   Não tem preço. O preço mora na tabela "planos" do banco, e quem
   cobra é a função de borda, que lê de lá. Se o valor estivesse aqui,
   ele estaria no código-fonte da página — e um preço que o navegador
   conhece é um preço que o navegador pode trocar.

   O que está aqui é aparência e vocabulário: emoji, nome, ordem. Nada
   que mude o que é cobrado.
   ===================================================================== */

const SELO_DO_PLANO = {
    destaque: '⭐',
    premium: '🔥',
    pro: '👑',
};

const NOME_DO_PLANO = {
    gratuito: 'Grátis',
    destaque: 'Destaque',
    premium: 'Premium',
    pro: 'Pro',
};

/* O que ordena a vitrine. Igual ao "peso" da tabela planos, e repetido
   aqui porque o cartão precisa comparar sem ir ao banco a cada clique.
   Se um dia mudar lá, muda aqui. */
const PESO_DO_PLANO = {
    gratuito: 0,
    destaque: 1,
    premium: 2,
    pro: 3,
};


/* ---------------------------------------------------------------------
   O destaque está valendo AGORA?

   Esta função é o coração da expiração, e ela é curta de propósito.

   As colunas destaque/destaque_peso/destaque_ate são calculadas pelo
   banco, mas nada garante que alguém tenha gravado a vaga depois de a
   data passar — e não existe tarefa noturna neste projeto. Então o
   navegador confere a data toda vez.

   O efeito: no segundo em que termina_em passa, o destaque para de ser
   desenhado em toda a plataforma, sem nada precisar rodar. Trinta dias
   é trinta dias, não "trinta dias até alguém lembrar de limpar".
   --------------------------------------------------------------------- */
function destaqueValendo(vaga) {
    if (!vaga || !vaga.destaque || !vaga.destaque_ate) return null;
    if (new Date(vaga.destaque_ate).getTime() <= Date.now()) return null;
    return vaga.destaque;
}

function pesoDoDestaque(vaga) {
    const plano = destaqueValendo(vaga);
    return plano ? (PESO_DO_PLANO[plano] || 0) : 0;
}


/* ---------------------------------------------------------------------
   Quantos dias faltam

   Arredonda para CIMA: às 23h do último dia ainda resta "1 dia", e não
   "0 dias" num destaque que continua aceso por mais uma hora. Dizer
   zero para algo que está funcionando é o tipo de detalhe que faz a
   pessoa achar que foi enganada.
   --------------------------------------------------------------------- */
function diasRestantes(ate) {
    if (!ate) return 0;
    const falta = new Date(ate).getTime() - Date.now();
    if (falta <= 0) return 0;
    return Math.ceil(falta / 86400000);
}

function frasedeDiasRestantes(ate) {
    const dias = diasRestantes(ate);
    if (dias <= 0) return 'terminado';
    return dias === 1 ? '1 dia restante' : `${dias} dias restantes`;
}


/* ---------------------------------------------------------------------
   Centavos para reais

   O banco guarda 3990. A tela mostra R$ 39,90. A conversão fica aqui
   para ninguém dividir por 100 no meio de um innerHTML e esquecer a
   vírgula em algum lugar.
   --------------------------------------------------------------------- */
function emReais(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function dataCurtaBR(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}


/* ---------------------------------------------------------------------
   O selo, pronto para pendurar

   Devolve null quando não há destaque valendo — e quem chama faz
   append de null sem quebrar? Não: quem chama precisa conferir. É de
   propósito que não devolva um span vazio, porque um selo vazio ocupa
   espaço na moldura e desalinha o cartão.
   --------------------------------------------------------------------- */
function seloDeDestaque(vaga) {
    const plano = destaqueValendo(vaga);
    if (!plano || !SELO_DO_PLANO[plano]) return null;

    const selo = document.createElement('span');
    selo.className = 'selo-destaque selo-' + plano;
    selo.textContent = `${SELO_DO_PLANO[plano]} ${NOME_DO_PLANO[plano]}`;
    selo.title = 'Anúncio destacado pelo anunciante';
    return selo;
}
