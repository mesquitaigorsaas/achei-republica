/* =====================================================================
   Achei República — o vocabulário das repúblicas

   Um lugar só para as ~50 características, os tipos de acomodação e os
   perfis de casa. Carregado por três páginas: o cadastro da vaga (que
   as oferece como caixas para marcar), a home (que as oferece como
   filtros) e a página da vaga (que as mostra como etiquetas).

   Por que num arquivo só: a característica é gravada no banco pelo
   APELIDO ('ar-condicionado'), e o filtro procura pelo apelido. Se as
   duas listas fossem escritas separadas, bastava um "arcondicionado"
   de um lado para o filtro parar de achar a casa — sem erro nenhum na
   tela, só uma lista vazia que ninguém entende. Escrito uma vez, não
   tem como divergir.

   Ao acrescentar uma característica: acrescente aqui e pronto. Não há
   coluna para criar — republica_marcas guarda uma linha por marca, foi
   desenhada assim no 01-esquema.sql exatamente para isto.
   ===================================================================== */


/* Tipo de acomodação. Vira a coluna "tipo" da tabela republicas, que
   tem check constraint: mudar um apelido aqui sem mudar o banco faz o
   cadastro falhar. Os apelidos abaixo são os do 01-esquema.sql. */
const TIPOS = [
    ['cama',                 'Cama'],
    ['quarto_compartilhado', 'Quarto compartilhado'],
    ['quarto_individual',    'Quarto individual'],
    ['kitnet',               'Kitnet'],
    ['apartamento',          'Apartamento'],
    ['casa',                 'Casa'],
    ['republica',            'República'],
];

/* Jeito da casa, escolha única. Também é coluna com check. */
const PERFIS = [
    ['mista',      'Mista'],
    ['feminina',   'Somente feminina'],
    ['masculina',  'Somente masculina'],
    ['lgbtqiapn',  'LGBTQIAPN+'],
];

/* Quem mora na casa. Coluna "composicao".

   "Quero um quarto, mas não numa casa cheia de estudante" é um pedido
   real, e tem quem procure exatamente o contrário — casa só de
   estudante, pela companhia de quem está na mesma rotina de prova.
   Sem esta pergunta o site não sabia responder nenhum dos dois. */
const COMPOSICOES = [
    ['donos',              'Só os donos'],
    ['estudantes',         'Só estudantes'],
    ['donos_e_estudantes', 'Os donos e estudantes'],
];

/* Como a pessoa vai até a faculdade. Coluna "modo". */
const MODOS = [
    ['pe',    'a pé'],
    ['bike',  'de bike'],
    ['carro', 'de carro'],
];

/* As características. Cada uma vira uma linha em republica_marcas.

   Os apelidos 'pet', 'silencioso' e 'festas' são especiais: o cálculo
   de compatibilidade em script.js procura por eles ao pontuar o "jeito
   de morar" que a pessoa respondeu no questionário. Renomear qualquer
   um dos três quebra a nota em silêncio. */
const MARCAS = [
    {
        grupo: 'Já vem incluso no aluguel',
        dica: 'Marque só o que não vem em conta separada.',
        itens: [
            ['agua',       'Água'],
            ['energia',    'Energia'],
            ['internet',   'Internet'],
            ['gas',        'Gás'],
            ['iptu',       'IPTU'],
            ['condominio', 'Condomínio'],
        ],
    },
    {
        grupo: 'Estrutura',
        itens: [
            ['mobiliado',        'Mobiliado'],
            ['cozinha-equipada', 'Cozinha equipada'],
            ['maquina-de-lavar', 'Máquina de lavar'],
            ['escrivaninha',     'Escrivaninha'],
            ['guarda-roupa',     'Guarda-roupa'],
            ['ar-condicionado',  'Ar-condicionado'],
            ['garagem',          'Garagem'],
            ['area-de-lazer',    'Área de lazer'],
            ['churrasqueira',    'Churrasqueira'],
            ['piscina',          'Piscina'],
            ['academia',         'Academia'],
            ['lavanderia',       'Lavanderia'],
            ['sacada',           'Sacada'],
            ['elevador',         'Elevador'],
            ['portaria-24h',     'Portaria 24h'],
            ['cameras',          'Câmeras'],
            ['portao-eletronico','Portão eletrônico'],
            ['acessivel',        'Acessível (PCD)'],
        ],
    },
    {
        grupo: 'Ambiente',
        dica: 'É o que o estudante mais pergunta na visita.',
        itens: [
            ['silencioso',     'Ambiente silencioso'],
            ['familiar',       'Ambiente familiar'],
            ['calouros',       'Aceita calouros'],
            ['intercambistas', 'Aceita intercambistas'],
        ],
    },
    {
        grupo: 'Regras da casa',
        itens: [
            ['pet',                'Aceita pet'],
            ['visitas',            'Aceita visitas'],
            ['pernoite',           'Permite pernoite'],
            ['horario-de-silencio','Tem horário de silêncio'],
            ['sem-festas',         'Sem festas'],
            ['festas',             'Tem festas'],
            ['fumantes',           'Aceita fumantes'],
        ],
    },
    {
        grupo: 'Taxas',
        dica: 'Marque o que a pessoa NÃO vai pagar.',
        itens: [
            ['sem-condominio', 'Sem taxa de condomínio'],
            ['sem-limpeza',    'Sem taxa de limpeza'],
        ],
    },
];


/* ---------------------------------------------------------------------
   Atalhos de leitura
   --------------------------------------------------------------------- */

/* Apelido -> nome por extenso, para as etiquetas do cartão e da página
   da vaga. Monta uma vez, na carga, em vez de varrer os grupos toda vez
   que um anúncio precisa de uma etiqueta. */
const NOME_DA_MARCA = {};
MARCAS.forEach(g => g.itens.forEach(([apelido, nome]) => {
    NOME_DA_MARCA[apelido] = nome;
}));

TIPOS.forEach(([apelido, nome])  => { NOME_DA_MARCA[apelido] = nome; });
PERFIS.forEach(([apelido, nome]) => { NOME_DA_MARCA[apelido] = nome; });
COMPOSICOES.forEach(([apelido, nome]) => { NOME_DA_MARCA[apelido] = nome; });

const NOME_DO_MODO = Object.fromEntries(MODOS);

/* Todas as marcas numa lista só, para conferir se um apelido vindo do
   banco ainda existe neste arquivo. Marca antiga, de quando o nome era
   outro, é ignorada em vez de virar etiqueta em branco no cartão. */
const MARCAS_CONHECIDAS = new Set(Object.keys(NOME_DA_MARCA));
