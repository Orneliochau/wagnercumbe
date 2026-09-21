/* Tracking Meta: Pixel (browser) + Conversions API (via /api/capi, o token nunca vem para o browser).
   Cada evento leva o mesmo event_id nos dois canais para o Meta deduplicar.
   Só faz algo se META_PIXEL_ID estiver definido no build (window.MO_CONFIG.pixelId). */
(function () {
  'use strict';
  var cfg = window.MO_CONFIG || {};
  if (!cfg.pixelId) return;

  var ENDPOINT = '/api/capi';
  function noop() {}

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return String(Date.now()) + Math.random().toString(16).slice(2);
  }
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function fbc() {
    var c = cookie('_fbc');
    if (c) return c;
    var id = new URLSearchParams(window.location.search).get('fbclid');
    return id ? 'fb.1.' + Date.now() + '.' + id : '';
  }

  function sendCapi(name, id, custom) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name: name,
          event_id: id,
          event_source_url: window.location.href,
          fbp: cookie('_fbp'),
          fbc: fbc(),
          custom_data: custom || {}
        })
      }).catch(noop);
    } catch (e) { /* ignora */ }
  }

  // Evento manual: browser + servidor com o mesmo event_id.
  function track(name, custom, eventId) {
    var id = eventId || uuid();
    if (typeof window.fbq === 'function') window.fbq('track', name, custom || {}, { eventID: id });
    sendCapi(name, id, custom);
    return id;
  }
  window.moTrack = track;

  // O cookie _fbp só existe depois de o fbevents.js carregar; esperamos até 2s para
  // o servidor enviar PageView/ViewContent já com fbp (melhor correspondência).
  function whenFbp(cb) {
    var tries = 0;
    (function poll() {
      if (cookie('_fbp') || ++tries > 20) return cb();
      setTimeout(poll, 100);
    })();
  }

  // PageView (já disparado no <head>) e ViewContent
  var viewContentId = uuid();
  var viewContentData = { content_name: document.title };
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', viewContentData, { eventID: viewContentId });
  }
  whenFbp(function () {
    if (window.moPageViewId) sendCapi('PageView', window.moPageViewId, {});
    sendCapi('ViewContent', viewContentId, viewContentData);
  });

  // InitiateCheckout: qualquer elemento com [data-checkout] que leve ao checkout.
  // O href é preenchido a partir de CHECKOUT_URL (build). Sem preventDefault, para
  // funcionar com abrir em nova aba; o fbq/fetch keepalive sobrevivem à navegação.
  var links = document.querySelectorAll('[data-checkout]');
  for (var i = 0; i < links.length; i++) {
    if (cfg.checkoutUrl) links[i].setAttribute('href', cfg.checkoutUrl);
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-checkout]') : null;
    if (!el) return;
    var last = Number(el.getAttribute('data-mo-fired') || 0);
    if (Date.now() - last < 1500) return; // evita duplicados por duplo clique
    el.setAttribute('data-mo-fired', String(Date.now()));
    track('InitiateCheckout', { content_name: document.title });
  });
})();
