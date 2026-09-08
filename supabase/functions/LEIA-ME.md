# Como pôr o pagamento no ar

Duas funções rodam no Supabase, fora do navegador. Elas existem por um
motivo só: **a chave secreta do Mercado Pago não pode estar no site**, e
o site é HTML estático — qualquer pessoa lê o código-fonte.

| Função | O que faz |
|---|---|
| `criar-pagamento` | Recebe *qual vaga*, *qual plano* e o que o formulário preencheu; lê o preço no banco, cria a promoção apagada e **cobra**. |
| `mercado-pago-avisa` | Recebe o aviso de pagamento, **pergunta de volta** ao Mercado Pago se foi mesmo aprovado, e só então acende o destaque. |

O formulário de cartão e Pix fica **dentro da nossa página** (o Payment
Brick do Mercado Pago), e não no site deles. O número do cartão nunca
passa pelo nosso servidor: o navegador o troca por um token direto com
o Mercado Pago, usando a chave pública, e é o token que a função usa.

---

## Antes de tudo: o SQL

Nesta ordem, no **SQL Editor** do Supabase:

1. `supabase/12-destaque-da-vaga.sql`
2. `supabase/13-metricas-da-vaga.sql`

O 12 é obrigatório antes de publicar o site. O 13 pode esperar — sem ele
as contagens simplesmente não sobem, e nada quebra.

---

## 1. Instalar o Supabase CLI

```
npm install -g supabase
supabase login
supabase link --project-ref zotpyhjfxngtqtthmtcf
```

## 2. Guardar os segredos

**Não cole nenhuma destas chaves em arquivo do repositório.** Elas vão
para os segredos do projeto, que só o servidor lê:

```
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxxxxxx
supabase secrets set MERCADO_PAGO_WEBHOOK_SECRET=xxxxxxxx
```

Onde achar cada uma, no painel do Mercado Pago
(*Seus negócios → Configurações → Gerenciar credenciais*):

- **Access token**: em *Credenciais de produção*. Começa com `APP_USR-`.
  Enquanto estiver testando, use o de *Credenciais de teste* — nenhum
  dinheiro de verdade se move.
- **Webhook secret**: em *Webhooks → Configurar notificações*, na
  "assinatura secreta" que aparece ao criar a notificação.

### E a chave PÚBLICA, que vai no site

Esta não é segredo — ela precisa estar no navegador, é com ela que o
formulário troca o número do cartão por um token. Cole em
`js/mercado-pago-config.js`, no lugar do `COLE_AQUI...`:

```
window.CONFIG_MERCADO_PAGO = {
    chavePublica: 'TEST-xxxxxxxx-xxxx-...'
};
```

**As duas têm de ser do mesmo par.** Chave pública de teste com access
token de teste; produção com produção. Misturadas, o Mercado Pago
recusa o token do cartão sem dizer por quê, e a mensagem que sobra na
tela é um genérico "confira os dados".

Enquanto estiver escrito `COLE_AQUI`, o site não abre o formulário: ele
diz que o destaque ainda não está disponível. É de propósito — pedir o
cartão inteiro para falhar no fim é pior do que avisar antes.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já
existem sozinhas dentro das funções — não precisa configurar.

## 3. Publicar as funções

```
supabase functions deploy criar-pagamento
supabase functions deploy mercado-pago-avisa --no-verify-jwt
```

O `--no-verify-jwt` na segunda **é obrigatório e não é um buraco**. O
Mercado Pago não tem conta no Supabase e não manda token nenhum; sem
esse sinalizador, todo aviso de pagamento seria recusado antes de
chegar ao código, e nenhum destaque acenderia. Quem faz o papel de
porteiro ali dentro é a conferência da assinatura `x-signature`, e ela
recusa qualquer aviso que não tenha sido assinado com o segredo acima.

## 4. Apontar o webhook

No painel do Mercado Pago, em *Webhooks*, cadastre a URL:

```
https://zotpyhjfxngtqtthmtcf.supabase.co/functions/v1/mercado-pago-avisa
```

Evento: **Pagamentos** (`payment`). É só esse — os outros são ignorados
com um 200 e vão embora.

---

## Conferir se está de pé

Com as credenciais de **teste**, compre um destaque pelo site usando um
[cartão de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards)
e acompanhe:

```
supabase functions logs mercado-pago-avisa
```

O que deve aparecer, nesta ordem:

1. `Destaque aceso para a promoção <uuid>` no log;
2. a promoção com `status = 'ativa'` na tabela `promocoes`;
3. a vaga com `destaque` preenchido em `republicas` — **sem ninguém ter
   escrito nessa coluna**, porque ela é calculada por gatilho;
4. o selo no cartão da vitrine.

Se o log disser `Assinatura inválida`, o `MERCADO_PAGO_WEBHOOK_SECRET`
não bate com o que está cadastrado no painel deles.

Se disser `Valor menor que o plano`, alguém pagou menos que o preço da
tabela. O destaque **não** acende, de propósito, e o caso aparece no seu
painel de administração com a observação escrita.

---

## O que nunca pode mudar aqui

1. **O preço vem do banco.** A função recebe `plano: 'premium'`, nunca
   `preco: 3990`. Se um dia alguém "simplificar" mandando o valor do
   navegador, o Premium passa a custar um centavo para quem souber abrir
   o console.

2. **O status vem da consulta de volta.** O aviso que chega diz apenas
   *qual* pagamento olhar. Quem diz se foi aprovado é a resposta da API
   deles à nossa pergunta, feita com a chave secreta.

3. **O destaque só acende por `ativar_promocao()`.** Ela está revogada
   de `anon` e `authenticated`: só a `service_role`, que existe apenas
   dentro destas funções, consegue chamá-la.
