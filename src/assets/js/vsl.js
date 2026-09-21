/* Contador do VSL — mantém a lógica original: 9 minutos a partir da 1.ª visita,
   guardados em localStorage com uma assinatura simples (chave mo_vsl_s). */
(function () {
  'use strict';
  var KEY = 'mo_vsl_s';
  var TOTAL = 540; // segundos

  function sign(n) {
    var h = 0, s = n + '|maquina-oculta-2026';
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function readStart() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var parts = raw.split('.');
      if (!parts[0] || !parts[1] || sign(parts[0]) !== parts[1]) return null;
      var n = Number(parts[0]);
      return isFinite(n) && n <= Date.now() + 5000 ? n : null;
    } catch (e) { return null; }
  }

  var start = readStart();
  if (start === null) {
    start = Date.now();
    try { window.localStorage.setItem(KEY, start + '.' + sign(String(start))); } catch (e) { /* modo privado: fica só em memória */ }
  }

  function remaining() {
    return Math.max(0, TOTAL - Math.floor((Date.now() - start) / 1000));
  }
  function fmt(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  var $ = function (id) { return document.getElementById(id); };
  var time = $('mo-time'), countdown = $('mo-countdown'), cta = $('mo-cta'),
      locked = $('mo-locked'), unlocked = $('mo-unlocked');
  if (!time || !countdown || !cta || !locked || !unlocked) return;

  var timer;
  function render() {
    var r = remaining();
    if (r > 0) { time.textContent = fmt(r); return; }
    clearInterval(timer);
    countdown.hidden = true;
    locked.hidden = true;
    cta.hidden = false;
    unlocked.hidden = false;
  }
  render();
  timer = setInterval(render, 1000);
})();
