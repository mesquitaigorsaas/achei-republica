-- =====================================================================
-- Achei República — as fotos das repúblicas
--
-- Rode DEPOIS do 07-tres-fotos-e-doacao.sql.
--
-- A tabela republica_fotos existe desde o 01-esquema.sql e nunca foi
-- usada: não havia onde guardar o arquivo. Este é o balde que faltava.
--
-- Cinco fotos, e não três como nos classificados. Um ventilador se
-- resolve em três ângulos; uma casa não. Quem vai morar num lugar quer
-- ver o quarto, a cozinha, o banheiro, a área comum e a fachada — e a
-- foto que falta é sempre a que a pessoa mais queria ver.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('republicas', 'republicas', true)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- Quem pode o quê
--
-- Mesma amarra do bucket 'itens': o caminho começa com o id do dono,
--
--   <uuid-do-dono>/<uuid-da-republica>/1788654537-a1b2c3.jpg
--
-- e é o primeiro pedaço que as regras conferem. Sem isso, qualquer
-- pessoa com conta apagaria as fotos do anúncio de qualquer outra.
--
-- Leitura aberta porque a vitrine é aberta: o estudante que está
-- procurando casa não tem conta e não deveria precisar de uma para ver
-- a foto do quarto.
-- ---------------------------------------------------------------------

drop policy if exists "republica_foto_leitura" on storage.objects;
create policy "republica_foto_leitura"
    on storage.objects for select
    using (bucket_id = 'republicas');

drop policy if exists "republica_foto_envia" on storage.objects;
create policy "republica_foto_envia"
    on storage.objects for insert
    with check (
        bucket_id = 'republicas'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "republica_foto_apaga" on storage.objects;
create policy "republica_foto_apaga"
    on storage.objects for delete
    using (
        bucket_id = 'republicas'
        and auth.uid()::text = (storage.foldername(name))[1]
    );


-- ---------------------------------------------------------------------
-- No máximo cinco, e a regra vive no banco
--
-- Em republica_fotos cada foto é uma LINHA, e não uma posição de array
-- como nos classificados. Isso é bom — a ordem é uma coluna, dá para
-- reordenar sem reescrever tudo — mas custa isto: um check não consegue
-- contar linhas irmãs. Precisa de gatilho.
--
-- Sem ele o limite viveria só no JavaScript da página, que é o mesmo
-- que não existir: qualquer pessoa com a chave pública, que está no
-- código-fonte, insere a sexta pela linha de comando.
-- ---------------------------------------------------------------------
create or replace function limitar_fotos_da_republica()
returns trigger language plpgsql as $$
declare
    quantas integer;
begin
    select count(*) into quantas
      from republica_fotos
     where republica_id = new.republica_id;

    if quantas >= 5 then
        raise exception 'Uma república tem no máximo 5 fotos (esta já tem %).', quantas;
    end if;

    return new;
end $$;

drop trigger if exists trg_limitar_fotos on republica_fotos;
create trigger trg_limitar_fotos
    before insert on republica_fotos
    for each row execute function limitar_fotos_da_republica();


-- ---------------------------------------------------------------------
-- Para conferir depois de rodar:
--
--   select id, public from storage.buckets where id = 'republicas';
--
-- Deve aparecer uma linha com public = true.
--
-- E o limite, que deve FALHAR na sexta:
--
--   insert into republica_fotos (republica_id, caminho, ordem)
--   select id, 'teste', 0 from republicas limit 1;   -- rode seis vezes
-- ---------------------------------------------------------------------


-- =====================================================================
-- O contato da vaga
--
-- A tabela republicas nasceu sem telefone, e o do anunciante mora em
-- perfis — que é privado: a regra perfis_le_o_seu deixa cada pessoa ler
-- só o próprio. Então o estudante que abre a vaga não tem como chamar
-- ninguém.
--
-- Abrir perfis para leitura pública resolveria e seria um erro: viraria
-- uma lista de telefones para qualquer um baixar com a chave que está
-- no código-fonte. O telefone que é PARA ser público vai na coluna do
-- anúncio, como já acontece nos classificados.
--
-- De quebra, deixa anunciar uma vaga num número diferente do cadastro —
-- o da casa, o da mãe, o da colega que atende melhor.
-- =====================================================================
alter table republicas add column if not exists whatsapp text;

-- Só dígitos, com DDD. Sem isto entra "(35) 99999-9999" numa linha e
-- "35999999999" na outra, e o link do wa.me quebra em metade delas.
alter table republicas drop constraint if exists republicas_whatsapp_digitos;
alter table republicas add constraint republicas_whatsapp_digitos
    check (whatsapp is null or whatsapp ~ '^[1-9][0-9]{9,10}$');
