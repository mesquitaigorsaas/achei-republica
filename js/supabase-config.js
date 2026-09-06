/* =====================================================================
   Endereço do banco — um lugar só.

   Estes dois valores são públicos de propósito: eles viajam dentro da
   página até o navegador de quem visita, então qualquer pessoa pode
   lê-los. Não é descuido, é como o Supabase foi feito. Quem decide o
   que cada visitante pode ver e mexer são as regras de segurança (RLS)
   dos arquivos em supabase/, do lado do banco.

   A senha do banco e a service_role key NÃO ficam aqui e nunca devem.
   Elas vivem só no painel do Supabase.

   ---------------------------------------------------------------------
   ONDE ISTO MORA — e uma dívida com data marcada

   Conta ....... mktrogeriocunha@gmail.com
   Organização . Rogerio Cunha (plano gratuito)
   Projeto ..... Achei Republica — zotpyhjfxngtqtthmtcf
   Região ...... South America (São Paulo)

   Repare no nome da conta: ela é do Rogério Cunha, um CLIENTE, e não
   do Achei República. Isso está errado de propósito, e a razão é
   prosaica: o plano gratuito do Supabase deixa cada pessoa ser dona de
   dois projetos, e a conta que guarda os outros produtos
   (mesquitaigor.saas@gmail.com) já estava com as duas vagas ocupadas
   pelo Achei Músico e pelo Guia Comércio. Esta conta tinha vaga.

   A dívida: no dia em que o site do Rogério for entregue a ele, esta
   conta vai junto — e o banco do Achei República não pode ir junto com
   ela. Antes desse dia, mover este projeto para uma conta própria. O
   Supabase move projeto entre organizações e entre contas; é chatice
   de meia hora, não impedimento.

   Deixado escrito aqui porque dívida esquecida vira surpresa no pior
   dia possível.
   --------------------------------------------------------------------- */
window.CONFIG_SUPABASE = {
    url: 'https://zotpyhjfxngtqtthmtcf.supabase.co',
    chavePublica: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvdHB5aGpmeG5ndHF0dGhtdGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NTQ1MzcsImV4cCI6MjEwNDIzMDUzN30.3I6NJRXfNYpb75Mvc2s_DVOEXos4y2gNiKOT5KUSzgw'
};
