-- =====================================================================
-- Achei República — estrutura do banco
--
-- Rode este arquivo no SQL Editor do Supabase, de uma vez.
--
-- Decisão que guia o desenho: as ~80 características do documento
-- (piscina, aceita pet, internet inclusa, ambiente silencioso...) NÃO
-- viram 80 colunas. Viram linhas na tabela republica_marcas. Assim
-- acrescentar uma característica nova é inserir um texto, não alterar a
-- tabela — e a busca por várias delas continua rápida com um índice só.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cidades e faculdades
-- ---------------------------------------------------------------------
create table if not exists cidades (
    id          uuid primary key default gen_random_uuid(),
    nome        text not null,
    uf          text not null default 'MG',
    slug        text not null unique,
    -- Uma cidade só aparece no seletor quando tem república cadastrada.
    ativa       boolean not null default false,
    criada_em   timestamptz not null default now()
);

create table if not exists faculdades (
    id          uuid primary key default gen_random_uuid(),
    cidade_id   uuid not null references cidades(id) on delete cascade,
    nome        text not null,
    sigla       text not null,
    -- Coordenadas para calcular trajeto de verdade mais para a frente.
    lat         numeric,
    lng         numeric
);

create index if not exists idx_faculdades_cidade on faculdades(cidade_id);

-- ---------------------------------------------------------------------
-- Perfis — estende o auth.users do Supabase
-- ---------------------------------------------------------------------
create table if not exists perfis (
    id          uuid primary key references auth.users(id) on delete cascade,
    nome        text,
    telefone    text,
    tipo        text not null default 'estudante'
                check (tipo in ('estudante', 'anunciante')),
    -- Só para estudante: alimenta o match sem precisar responder toda vez.
    curso       text,
    faculdade_id uuid references faculdades(id),
    criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Repúblicas
-- ---------------------------------------------------------------------
create table if not exists republicas (
    id            uuid primary key default gen_random_uuid(),
    dono_id       uuid not null references auth.users(id) on delete cascade,
    cidade_id     uuid not null references cidades(id),
    faculdade_id  uuid references faculdades(id),

    nome          text not null,
    bairro        text,
    descricao     text,

    tipo          text not null
                  check (tipo in ('cama','quarto_compartilhado','quarto_individual',
                                  'kitnet','apartamento','casa','republica')),
    perfil        text not null default 'mista'
                  check (perfil in ('mista','feminina','masculina','lgbtqiapn')),

    preco         numeric(10,2) not null,
    caucao        numeric(10,2) not null default 0,

    -- Trajeto até a faculdade escolhida, informado pelo anunciante.
    minutos       integer,
    modo          text check (modo in ('pe','bike','carro')),

    vagas         integer not null default 1 check (vagas >= 0),
    disponivel_em date,

    -- Fica falsa quando a vaga é preenchida: some da lista sozinha.
    ativa         boolean not null default true,
    criada_em     timestamptz not null default now(),
    atualizada_em timestamptz not null default now()
);

create index if not exists idx_republicas_cidade on republicas(cidade_id) where ativa;
create index if not exists idx_republicas_preco  on republicas(preco)     where ativa;

-- ---------------------------------------------------------------------
-- Características, cursos e fotos
-- ---------------------------------------------------------------------

-- 'pet', 'internet', 'silencioso', 'piscina', 'mobiliado', 'garagem'...
create table if not exists republica_marcas (
    republica_id uuid not null references republicas(id) on delete cascade,
    marca        text not null,
    primary key (republica_id, marca)
);

create index if not exists idx_marcas_marca on republica_marcas(marca);

-- Cursos de quem já mora na casa: é o que permite o "tem gente do seu
-- curso morando lá", que é o motivo de match mais forte da lista.
create table if not exists republica_cursos (
    republica_id uuid not null references republicas(id) on delete cascade,
    curso        text not null,
    primary key (republica_id, curso)
);

create index if not exists idx_cursos_curso on republica_cursos(curso);

create table if not exists republica_fotos (
    id           uuid primary key default gen_random_uuid(),
    republica_id uuid not null references republicas(id) on delete cascade,
    caminho      text not null,
    ordem        integer not null default 0
);

create index if not exists idx_fotos_republica on republica_fotos(republica_id);

-- ---------------------------------------------------------------------
-- atualizada_em automático
-- ---------------------------------------------------------------------
create or replace function tocar_atualizada_em()
returns trigger language plpgsql as $$
begin
    new.atualizada_em = now();
    return new;
end $$;

drop trigger if exists trg_republicas_atualizada on republicas;
create trigger trg_republicas_atualizada
    before update on republicas
    for each row execute function tocar_atualizada_em();
