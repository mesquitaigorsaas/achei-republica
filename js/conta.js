/* =====================================================================
   Achei República — conta do anunciante.

   Um arquivo só para o login e o cadastro, porque as duas páginas
   precisam exatamente das mesmas três coisas: falar com o Supabase,
   mostrar recado de erro e cuidar dos campos de senha.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Ligação com o banco
   --------------------------------------------------------------------- */
const cfg = window.CONFIG_SUPABASE || {};
const configurado = cfg.url && !cfg.url.startsWith('COLE_AQUI');

const banco = configurado
    ? window.supabase.createClient(cfg.url, cfg.chavePublica)
    : null;

/* ---------------------------------------------------------------------
   Menu sanduíche

   Abaixo de 1030px o style.css esconde o menu e passa a bola para o
   botão. Sem este trecho, a navegação some no celular — que é onde a
   maior parte das pessoas vai preencher estes formulários.

   O script.js da home faria isso, mas ele também mexe no questionário
   e nas fichas de busca, que não existem aqui.
   --------------------------------------------------------------------- */
const menuBotao = document.querySelector('.menu-botao');
const menu = document.getElementById('menu');

if (menuBotao && menu) {
    const fecharMenu = () => {
        menu.classList.remove('aberto');
        menuBotao.classList.remove('aberto');
        menuBotao.setAttribute('aria-expanded', 'false');
        menuBotao.setAttribute('aria-label', 'Abrir menu');
    };

    menuBotao.addEventListener('click', () => {
        const aberto = menu.classList.toggle('aberto');
        menuBotao.classList.toggle('aberto', aberto);
        menuBotao.setAttribute('aria-expanded', String(aberto));
        menuBotao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    });

    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', fecharMenu));

    document.addEventListener('click', e => {
        if (!menu.contains(e.target) && !menuBotao.contains(e.target)) fecharMenu();
    });
}

/* ---------------------------------------------------------------------
   Recados

   Um lugar só na tela para erro e confirmação. Erro que aparece longe
   do formulário é erro que a pessoa não vê.
   --------------------------------------------------------------------- */
const caixaRecado = document.getElementById('recado');

function recado(texto, tipo = 'erro') {
    if (!caixaRecado) return;
    caixaRecado.textContent = texto;
    caixaRecado.className = 'recado recado-' + tipo;
    caixaRecado.hidden = false;
    caixaRecado.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function limparRecado() {
    if (caixaRecado) caixaRecado.hidden = true;
}

/* O Supabase responde em inglês. Quem está cadastrando não tem que
 * saber inglês para entender que o e-mail já existe. */
function traduzir(erro) {
    const m = (erro && erro.message ? erro.message : String(erro)).toLowerCase();

    if (m.includes('invalid login credentials')) return 'E-mail ou senha não conferem.';
    if (m.includes('email not confirmed'))       return 'Confirme o e-mail que enviamos antes de entrar.';
    if (m.includes('user already registered'))   return 'Já existe uma conta com esse e-mail. Tente entrar.';
    if (m.includes('idx_perfis_telefone') || m.includes('duplicate key') && m.includes('telefone'))
        return 'Esse WhatsApp já está em uma conta. Cada número tem um cadastro só.';
    if (m.includes('duplicate key'))             return 'Esses dados já estão cadastrados.';
    if (m.includes('password'))                  return 'A senha precisa de pelo menos 6 caracteres.';
    if (m.includes('rate limit') || m.includes('too many'))
        return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    if (m.includes('failed to fetch') || m.includes('networkerror'))
        return 'Sem conexão com o servidor. Confira a internet e tente de novo.';

    return 'Não deu certo: ' + (erro && erro.message ? erro.message : 'erro desconhecido');
}

/* ---------------------------------------------------------------------
   Botão que trabalha

   Trava o botão enquanto o servidor responde. Sem isso a pessoa clica
   três vezes achando que não pegou, e nascem três cadastros.
   --------------------------------------------------------------------- */
function ocupado(botao, sim, textoOcupado = 'Aguarde...') {
    if (!botao) return;
    if (sim) {
        botao.dataset.textoOriginal = botao.textContent;
        botao.textContent = textoOcupado;
        botao.disabled = true;
    } else {
        botao.textContent = botao.dataset.textoOriginal || botao.textContent;
        botao.disabled = false;
    }
}

/* ---------------------------------------------------------------------
   Olho da senha
   --------------------------------------------------------------------- */
document.querySelectorAll('.olho').forEach(botao => {
    botao.addEventListener('click', () => {
        const campo = document.getElementById(botao.dataset.campo);
        if (!campo) return;
        const escondida = campo.type === 'password';
        campo.type = escondida ? 'text' : 'password';
        botao.setAttribute('aria-label', escondida ? 'Esconder a senha' : 'Mostrar a senha');
        botao.classList.toggle('aberto', escondida);
    });
});

/* ---------------------------------------------------------------------
   Máscara de telefone e de CEP

   Formata enquanto digita, sem impedir apagar.
   --------------------------------------------------------------------- */
function mascararTelefone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2)  return d;
    if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mascararCep(v) {
    const d = v.replace(/\D/g, '').slice(0, 8);
    return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

document.querySelectorAll('[data-mascara="telefone"]').forEach(campo => {
    campo.addEventListener('input', () => { campo.value = mascararTelefone(campo.value); });
});

document.querySelectorAll('[data-mascara="cep"]').forEach(campo => {
    campo.addEventListener('input', () => { campo.value = mascararCep(campo.value); });
});

/* ---------------------------------------------------------------------
   CEP preenche o endereço

   Oito dígitos e o resto do endereço aparece sozinho. Se o ViaCEP
   estiver fora do ar, os campos continuam editáveis à mão — nunca
   travamos o cadastro por causa de um serviço de terceiro.
   --------------------------------------------------------------------- */
async function buscarCep(cep, campos) {
    const digitos = cep.replace(/\D/g, '');
    if (digitos.length !== 8) return;

    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
        const dados = await resposta.json();
        if (dados.erro) return;

        if (!campos.logradouro.value) campos.logradouro.value = dados.logradouro || '';
        if (!campos.bairro.value)     campos.bairro.value     = dados.bairro || '';
        campos.cidade.value = dados.localidade || campos.cidade.value;
        campos.uf.value     = dados.uf || campos.uf.value;

        campos.numero.focus();
    } catch (e) {
        /* Silêncio de propósito: o endereço fica para a pessoa digitar. */
    }
}

/* ---------------------------------------------------------------------
   Para onde ir depois de entrar
   --------------------------------------------------------------------- */
function destinoDepoisDoLogin() {
    const pedido = new URLSearchParams(location.search).get('destino');
    /* Só caminho interno: link de fora vindo pela URL viraria um jeito
     * bonito de mandar a pessoa para uma página falsa. */
    if (pedido && pedido.startsWith('/') && !pedido.startsWith('//')) return pedido;

    /* painel/anuncios.html nunca existiu: quem entrava caia num 404 do
     * GitHub Pages, que não é nem página do site. Até o painel das
     * vagas existir, a volta é para anunciar.html — o único lugar onde
     * quem está logado tem o que fazer: publicar e tirar do ar os
     * próprios anúncios. */
    return '../anunciar.html';
}
