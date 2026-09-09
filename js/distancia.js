/* =====================================================================
   Achei República — distância entre a casa e a faculdade

   Carregado pela home e pela página da vaga, antes dos scripts que o
   usam. Mora num arquivo só porque as duas páginas precisam da mesma
   conta, e duas cópias da mesma fórmula viram duas verdades no dia em
   que alguém corrigir uma delas.

   ---------------------------------------------------------------------
   POR QUE DISTÂNCIA, E NÃO TEMPO

   O tempo até a faculdade era digitado pelo anunciante e ninguém
   conferia. Quem tinha pressa de alugar escrevia 10 onde eram 20, e
   isso subia a casa na busca — o trajeto vale 20 dos 100 pontos da nota
   de compatibilidade.

   Distância o site mede sozinho, e ela é a medida honesta por um motivo
   simples: um quilômetro a pé e um quilômetro de bike são o mesmo
   quilômetro. O tempo depende de quem anda; a distância, não.

   ---------------------------------------------------------------------
   O QUE ESTA CONTA NÃO É

   Não é o caminho a pé. É a linha reta sobre a superfície da Terra, e
   ela não conhece rua, morro, viaduto nem córrego — em Belo Horizonte
   isso pesa de verdade.

   Serve para ORDENAR e COMPARAR, que é o que a busca precisa: entre uma
   casa a 800 metros e outra a 3 km, a mais perto é a mais perto por
   qualquer caminho.

   Não serve para prometer tempo, e por isso o site não converte isto em
   minutos em lugar nenhum da tela. Quem quer o tempo real clica no
   botão de trajeto, na página da vaga, e o Google responde com rua,
   morro e semáforo — de graça, no aplicativo de quem perguntou.
   ===================================================================== */

function distanciaEmKm(lat1, lng1, lat2, lng2) {
    const n = v => (v === null || v === undefined || v === '' ? null : Number(v));
    const a1 = n(lat1), o1 = n(lng1), a2 = n(lat2), o2 = n(lng2);

    if ([a1, o1, a2, o2].some(v => v === null || !Number.isFinite(v))) return null;

    const R = 6371;                       // raio da Terra em km
    const rad = g => g * Math.PI / 180;
    const dLat = rad(a2 - a1);
    const dLng = rad(o2 - o1);

    const h = Math.sin(dLat / 2) ** 2
            + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* "1,2 km" — vírgula, porque é português, e uma casa decimal, porque
   duas fingiriam uma precisão que a linha reta não tem.

   Abaixo de um quilômetro vai em metros, arredondado à centena: "800 m"
   se lê mais rápido que "0,8 km", e o arredondamento não deixa escapar
   um "137 m" que soaria medido com trena. */
function kmEscrito(km) {
    if (km === null || km === undefined || !Number.isFinite(Number(km))) return null;

    const v = Number(km);
    if (v < 1) return Math.max(100, Math.round(v * 1000 / 100) * 100) + ' m';
    return v.toFixed(1).replace('.', ',') + ' km';
}
