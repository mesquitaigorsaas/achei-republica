-- =====================================================================
-- Achei República — um anúncio por conta
--
-- Rode DEPOIS do 09-quem-mora-e-onde.sql.
--
-- A regra: cada anunciante tem direito a UM anúncio no ar. Quem tem
-- duas repúblicas de verdade fala com você, e você libera.
--
-- Mesmo desenho do Comércio Alfenas, e pelo mesmo motivo: não existe
-- jeito de detectar um corretor, mas dá para encarecer o volume. Dono
-- de uma casa nunca esbarra nisto. Quem vive de anunciar, esbarra no
-- segundo anúncio.
--
-- POR QUE POR CONTA, E NÃO POR "PESSOA"
--
-- O 04-anunciante.sql já agrupa contas parecidas — mesmo nome, ou mesmo
-- endereço até o complemento — na função contas_do_mesmo_anunciante().
-- Aquele agrupamento tem falso positivo assumido: dois moradores da
-- mesma casa anunciando vagas diferentes caem juntos.
--
-- Isso era aceitável enquanto a consequência era "vai para a fila".
-- Como bloqueio, não é: barraria dois colegas de casa honestos, e o
-- segundo levaria um "não" sem entender por quê.
--
-- Então o bloqueio duro olha só para a própria conta, que é exatamente
-- o que "mesmo e-mail, mesmo telefone" quer dizer:
--
--   e-mail   — o Supabase já não deixa duas contas com o mesmo
--   telefone — o índice idx_perfis_telefone do 04 já não deixa
--
-- E o agrupamento por semelhança continua vivo, mandando para revisão.
-- Duas redes, com dureza diferente, pegando coisas diferentes.
-- =====================================================================


-- ---------------------------------------------------------------------
-- O teto de cada conta
--
-- Número e não um sim/não: quem tem três repúblicas de verdade recebe
-- 3, e não "liberado para sempre". A diferença aparece no dia em que a
-- conta liberada começa a anunciar a décima.
-- ---------------------------------------------------------------------
alter table perfis add column if not exists limite_anuncios integer not null default 1;

alter table perfis drop constraint if exists perfis_limite_plausivel;
alter table perfis add constraint perfis_limite_plausivel
    check (limite_anuncios >= 1 and limite_anuncios <= 50);

comment on column perfis.limite_anuncios is
    'Quantos anúncios ativos esta conta pode ter ao mesmo tempo. Padrão 1. Só você aumenta.';


-- ---------------------------------------------------------------------
-- A trava
--
-- Conta anúncio ATIVO, e não anúncio que já existiu. Quem alugou o
-- quarto, tirou do ar e quer anunciar outro não deve esbarrar em nada —
-- a vaga anterior não ocupa mais lugar nenhum.
--
-- Roda no insert e no update: sem o update, bastaria cadastrar o
-- segundo fora do ar e depois pôr no ar para passar por baixo.
-- ---------------------------------------------------------------------
create or replace function limitar_anuncios_da_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    quantos integer;
    teto    integer;
begin
    -- Anúncio fora do ar não ocupa vaga. Isso deixa a pessoa preparar o
    -- próximo com calma antes de tirar o atual.
    if not new.ativa then
        return new;
    end if;

    -- No update, só interessa quando o anúncio ESTÁ ENTRANDO no ar. Sem
    -- esta saída, editar o preço do único anúncio ativo se contaria
    -- contra ele mesmo em bancos onde o old já contasse.
    if tg_op = 'UPDATE' and old.ativa then
        return new;
    end if;

    select coalesce(p.limite_anuncios, 1) into teto
      from perfis p
     where p.id = new.dono_id;

    teto := coalesce(teto, 1);

    select count(*) into quantos
      from republicas r
     where r.dono_id = new.dono_id
       and r.id <> new.id
       and r.ativa;

    if quantos >= teto then
        -- A mensagem começa com uma etiqueta que o site reconhece para
        -- traduzir. O resto é para quem lê o erro cru no painel.
        raise exception
            'LIMITE_DE_ANUNCIOS: esta conta pode ter % anúncio(s) no ar e já tem %.',
            teto, quantos;
    end if;

    return new;
end $$;

drop trigger if exists trg_limite_anuncios on republicas;
create trigger trg_limite_anuncios
    before insert or update on republicas
    for each row execute function limitar_anuncios_da_conta();


-- ---------------------------------------------------------------------
-- Seu painel, enquanto não existe painel
--
-- Esta view é a tela de liberação: abra no Supabase, em Table Editor →
-- anunciantes. Traz o e-mail, o telefone, quantos anúncios a conta tem
-- no ar, o teto atual e quantas denúncias os anúncios dela receberam.
--
-- O e-mail mora em auth.users e não em perfis — por isso a junção.
-- ---------------------------------------------------------------------
create or replace view anunciantes as
    select p.id,
           u.email,
           p.nome,
           p.telefone,
           p.relacao,
           p.limite_anuncios,
           p.bloqueado,
           (select count(*) from republicas r
             where r.dono_id = p.id and r.ativa)            as anuncios_no_ar,
           (select count(*) from republicas r
             where r.dono_id = p.id)                        as anuncios_no_total,
           (select count(*) from denuncias d
              join republicas r on r.id = d.republica_id
             where r.dono_id = p.id)                        as denuncias,
           p.criado_em
      from perfis p
      join auth.users u on u.id = p.id
     order by p.criado_em desc;


-- ---------------------------------------------------------------------
-- COMO LIBERAR ALGUÉM
--
-- A pessoa te procurou dizendo que tem duas repúblicas. Você confere e
-- libera pelo e-mail dela:
--
--   update perfis set limite_anuncios = 2
--    where id = (select id from auth.users where email = 'fulano@exemplo.com');
--
-- Ou pelo telefone, se foi por onde ela falou com você:
--
--   update perfis set limite_anuncios = 2
--    where so_digitos(telefone) = so_digitos('35999998888');
--
-- Para voltar atrás, o mesmo comando com 1.
--
-- E para barrar de vez quem se confirmou corretor — isto impede novos
-- anúncios sem apagar os que existem:
--
--   update perfis set bloqueado = true
--    where id = (select id from auth.users where email = 'fulano@exemplo.com');
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- Para conferir depois de rodar:
--
--   select email, nome, anuncios_no_ar, limite_anuncios from anunciantes;
--
-- E a trava, que deve FALHAR na segunda vez (rode duas):
--
--   insert into republicas
--       (dono_id, cidade_id, nome, tipo, preco, bairro, logradouro, numero)
--   values (auth.uid(), (select id from cidades where slug = 'alfenas'),
--           'Teste da trava', 'quarto_individual', 500, 'Centro', 'Rua X', '1');
--
-- A segunda deve dar "LIMITE_DE_ANUNCIOS". Apague as duas depois:
--
--   delete from republicas where nome = 'Teste da trava';
-- ---------------------------------------------------------------------
