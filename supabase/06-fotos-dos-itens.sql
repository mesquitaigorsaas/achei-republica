-- =====================================================================
-- Achei República — as fotos dos classificados
--
-- Rode DEPOIS do 05-classificados.sql.
--
-- Anúncio de geladeira sem foto não vende. O texto diz o que é; a foto
-- é o que faz alguém parar de rolar.
--
-- O bucket é público na LEITURA porque a vitrine é pública: quem passa
-- pelo site precisa ver a foto sem ter conta. Escrever é outra
-- história — só quem tem conta, e só dentro da própria pasta.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('itens', 'itens', true)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- Quem pode o quê
--
-- O caminho de cada arquivo começa com o id do dono:
--   <uuid-do-dono>/1788654537-a1b2c3.jpg
--
-- É isso que as regras abaixo checam. storage.foldername() devolve os
-- pedaços do caminho, e o primeiro deles tem que ser o id de quem está
-- pedindo. Sem essa amarra, qualquer pessoa com conta poderia apagar a
-- foto do anúncio de qualquer outra.
-- ---------------------------------------------------------------------

drop policy if exists "itens_foto_leitura" on storage.objects;
create policy "itens_foto_leitura"
    on storage.objects for select
    using (bucket_id = 'itens');

drop policy if exists "itens_foto_envia" on storage.objects;
create policy "itens_foto_envia"
    on storage.objects for insert
    with check (
        bucket_id = 'itens'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "itens_foto_apaga" on storage.objects;
create policy "itens_foto_apaga"
    on storage.objects for delete
    using (
        bucket_id = 'itens'
        and auth.uid()::text = (storage.foldername(name))[1]
    );


-- ---------------------------------------------------------------------
-- Para conferir depois de rodar:
--
--   select id, public from storage.buckets where id = 'itens';
--
-- Deve aparecer uma linha com public = true.
--
-- A barreira de verdade se testa pelo site: entre com uma conta,
-- anuncie com foto, e veja o arquivo aparecer em Storage → itens,
-- dentro de uma pasta com o id daquela conta.
-- ---------------------------------------------------------------------
