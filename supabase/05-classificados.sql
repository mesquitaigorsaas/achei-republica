-- =====================================================================
-- Achei República — classificados
--
-- Rode DEPOIS do 04-anunciante.sql.
--
-- Quem sai da cidade tem geladeira, ventilador e escrivaninha que não
-- cabem na mudança. Quem chega precisa exatamente disso e não quer
-- comprar novo. Hoje os dois se encontram por acaso, num grupo de
-- WhatsApp onde o anúncio some na rolagem em duas horas.
--
-- Uma tabela só, e nenhuma tabela de categorias: os cinco cômodos são
-- fixos e cabem num check. Categoria em tabela separada só se paga
-- quando alguém pode criar categoria nova, e ninguém pode — a lista é
-- decisão de produto, não conteúdo do usuário.
-- =====================================================================

create table if not exists itens (
    id          uuid primary key default gen_random_uuid(),

    -- O dono. Sem ele não há como editar nem apagar depois, e o
    -- anúncio viraria lixo permanente. É também o que liga o item ao
    -- perfil, de onde sai o WhatsApp na hora de mostrar.
    dono_id     uuid not null references auth.users(id) on delete cascade,

    -- A cidade vem como texto, no mesmo formato do seletor da home
    -- ("alfenas", "pocos-de-caldas"). A tabela cidades existe no
    -- 01-esquema.sql e um dia isto vira referência a ela; enquanto o
    -- front lê a lista do próprio HTML, apontar para a tabela criaria
    -- duas fontes de verdade em vez de uma.
    cidade      text not null check (length(trim(cidade)) > 0),

    comodo      text not null
                check (comodo in ('quarto', 'cozinha', 'banheiro',
                                  'area-de-servico', 'quintal')),

    titulo      text not null check (length(trim(titulo)) between 3 and 80),
    descricao   text not null default '',

    -- Em centavos não: o aluno digita "150" e não "150,00". numeric
    -- guarda o real sem o erro de arredondamento do float, e zero é
    -- doação — que numa mudança de fim de semestre é metade dos casos.
    preco       numeric(8,2) not null default 0 check (preco >= 0),

    foto_url    text,

    -- O contato é o WhatsApp, como no resto do site. Fica na tabela e
    -- não só no perfil porque a pessoa pode querer atender num número
    -- diferente do que usou para se cadastrar.
    whatsapp    text not null check (length(trim(whatsapp)) >= 10),

    -- Sai do ar sem ser apagado: vendeu, e o anúncio some da vitrine
    -- mas continua no painel dele, com o histórico.
    publicado   boolean not null default true,

    criado_em   timestamptz not null default now()
);

-- A vitrine sempre pergunta a mesma coisa: publicados, desta cidade,
-- deste cômodo, mais novos primeiro.
create index if not exists itens_da_vitrine
    on itens (publicado, cidade, comodo, criado_em desc);

-- O painel do dono pergunta outra: os meus, mais novos primeiro.
create index if not exists itens_do_dono
    on itens (dono_id, criado_em desc);


-- ---------------------------------------------------------------------
-- Segurança
--
-- Mesmo desenho das repúblicas no 02-seguranca.sql: quem visita lê o
-- que está publicado, e só o dono escreve o que é dele.
-- ---------------------------------------------------------------------
alter table itens enable row level security;

-- Anúncio despublicado continua visível para o dono — senão ele marca
-- "vendido" e o próprio anúncio some da tela dele, parecendo apagado.
drop policy if exists itens_leitura on itens;
create policy itens_leitura on itens
    for select using (publicado or auth.uid() = dono_id);

drop policy if exists itens_cria on itens;
create policy itens_cria on itens
    for insert with check (auth.uid() = dono_id);

drop policy if exists itens_edita on itens;
create policy itens_edita on itens
    for update using (auth.uid() = dono_id) with check (auth.uid() = dono_id);

drop policy if exists itens_apaga on itens;
create policy itens_apaga on itens
    for delete using (auth.uid() = dono_id);


-- ---------------------------------------------------------------------
-- Para conferir depois de rodar:
--
--   select count(*) from itens;   -- zero, por enquanto
--
-- E que a barreira está de pé — esta linha deve FALHAR, porque a
-- chave pública não é dona de nada:
--
--   insert into itens (dono_id, cidade, comodo, titulo, whatsapp)
--   values (gen_random_uuid(), 'alfenas', 'cozinha', 'Geladeira', '35999999999');
--
-- Se ela passar, a RLS não está valendo e nada mais neste arquivo
-- protege coisa nenhuma.
-- ---------------------------------------------------------------------
