-- =====================================================================
-- Achei República — Row Level Security
--
-- Rode DEPOIS do 01-esquema.sql.
--
-- Por que isto é a parte séria: a chave que vai dentro do JavaScript da
-- página (a "anon key") é pública por natureza — qualquer pessoa abre o
-- código-fonte e lê. Ela não é segredo e não deve ser tratada como tal.
-- Quem impede um estranho de apagar as repúblicas dos outros são as
-- regras abaixo, não a chave.
--
-- Regra geral: leitura aberta para o que é anúncio público, escrita só
-- para o dono do próprio registro.
--
-- NUNCA coloque a service_role key no site. Essa sim é segredo, ignora
-- todas as regras abaixo e só serve em servidor.
-- =====================================================================

alter table cidades          enable row level security;
alter table faculdades       enable row level security;
alter table perfis           enable row level security;
alter table republicas       enable row level security;
alter table republica_marcas enable row level security;
alter table republica_cursos enable row level security;
alter table republica_fotos  enable row level security;

-- ---------------------------------------------------------------------
-- Cidades e faculdades: qualquer um lê, ninguém escreve pelo site.
-- Cadastro de cidade nova é feito por você, pelo painel do Supabase.
-- ---------------------------------------------------------------------
drop policy if exists cidades_leitura on cidades;
create policy cidades_leitura on cidades
    for select using (true);

drop policy if exists faculdades_leitura on faculdades;
create policy faculdades_leitura on faculdades
    for select using (true);

-- ---------------------------------------------------------------------
-- Perfis: cada pessoa enxerga e mexe apenas no seu.
-- ---------------------------------------------------------------------
drop policy if exists perfis_le_o_seu on perfis;
create policy perfis_le_o_seu on perfis
    for select using (auth.uid() = id);

drop policy if exists perfis_cria_o_seu on perfis;
create policy perfis_cria_o_seu on perfis
    for insert with check (auth.uid() = id);

drop policy if exists perfis_edita_o_seu on perfis;
create policy perfis_edita_o_seu on perfis
    for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- Repúblicas: anúncio ativo é público; mexer, só o dono.
--
-- O dono enxerga também os próprios anúncios desativados — senão ele
-- perderia de vista a vaga que acabou de preencher.
-- ---------------------------------------------------------------------
drop policy if exists republicas_leitura on republicas;
create policy republicas_leitura on republicas
    for select using (ativa or auth.uid() = dono_id);

drop policy if exists republicas_cria on republicas;
create policy republicas_cria on republicas
    for insert with check (auth.uid() = dono_id);

drop policy if exists republicas_edita on republicas;
create policy republicas_edita on republicas
    for update using (auth.uid() = dono_id) with check (auth.uid() = dono_id);

drop policy if exists republicas_apaga on republicas;
create policy republicas_apaga on republicas
    for delete using (auth.uid() = dono_id);

-- ---------------------------------------------------------------------
-- Tabelas filhas: seguem o dono da república.
--
-- Sem estas, alguém poderia acrescentar "tem piscina" no anúncio dos
-- outros — a regra da tabela mãe sozinha não protege as filhas.
-- ---------------------------------------------------------------------
create or replace function e_dono_da_republica(alvo uuid)
returns boolean language sql security invoker stable as $$
    select exists (
        select 1 from republicas r
        where r.id = alvo and r.dono_id = auth.uid()
    );
$$;

create or replace function republica_visivel(alvo uuid)
returns boolean language sql security invoker stable as $$
    select exists (
        select 1 from republicas r
        where r.id = alvo and (r.ativa or r.dono_id = auth.uid())
    );
$$;

do $$
declare t text;
begin
    foreach t in array array['republica_marcas','republica_cursos','republica_fotos']
    loop
        execute format('drop policy if exists %I_leitura on %I', t, t);
        execute format(
            'create policy %I_leitura on %I for select using (republica_visivel(republica_id))', t, t);

        execute format('drop policy if exists %I_escrita on %I', t, t);
        execute format(
            'create policy %I_escrita on %I for all using (e_dono_da_republica(republica_id))
             with check (e_dono_da_republica(republica_id))', t, t);
    end loop;
end $$;
