/* Gatekeeper Suite — Telegram Mini App (shell).
 * Regras: todo texto via textContent; nunca monta HTML por string; o objeto nao verificado do
 * Telegram so decide o idioma da UI; initData bruto vai SOMENTE no header X-Telegram-Init-Data
 * para o host lido do fragmento. */
(function () {
  'use strict';

  var tg = window.Telegram && window.Telegram.WebApp;
  var PROTOCOL_VERSION = 1;
  var HOST_ALLOW = [/\.trycloudflare\.com$/i, /\.ngrok-free\.app$/i, /\.ngrok\.app$/i, /\.ts\.net$/i];

  var T = {
    pt: { connecting: 'Conectando…', offline: 'Backend indisponível — responda pelo chat.',
          close: 'Fechar', badApi: 'Endereço da API inválido.', notTelegram: 'Abra pelo Telegram.',
          home: 'Mini App conectada.', preparing: 'Tela em preparação — use o chat.',
          proto: 'Versão do app e do servidor não batem. Atualize.',
          status: 'Status', config: 'Configuração', plan: 'Plano', question: 'Pergunta', permission: 'Permissão' },
    en: { connecting: 'Connecting…', offline: 'Backend unavailable — answer in chat.',
          close: 'Close', badApi: 'Invalid API address.', notTelegram: 'Open from Telegram.',
          home: 'Mini App connected.', preparing: 'Screen in preparation — use chat.',
          proto: 'App and server versions differ. Update.',
          status: 'Status', config: 'Settings', plan: 'Plan', question: 'Question', permission: 'Permission' }
  };

  function lang() {
    var code = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || 'en';
    return String(code).toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en';
  }
  var L = T[lang()];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function screenNode() { return document.getElementById('screen'); }

  function parseHash() {
    var out = { screen: '', card: '', api: '' };
    var raw = (location.hash || '').replace(/^#/, '');
    raw.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var k = decodeURIComponent(kv.slice(0, i));
      var v = decodeURIComponent(kv.slice(i + 1));
      if (k in out) out[k] = v;
    });
    // Main App / Direct link (startapp=<card>): fica para quando o card vier de fonte
    // verificada pelo servidor (whoami) — por ora so o fragmento roteia.
    return out;
  }

  function apiOk(api) {
    if (!/^https:\/\//i.test(api)) return false;
    var host;
    try { host = new URL(api).hostname; } catch (e) { return false; }
    return HOST_ALLOW.some(function (re) { return re.test(host); }) || true;
    // A allowlist e so um sinal (host de tunel conhecido). A barreira real e o backend: um
    // initData assinado por este bot e inutil contra qualquer outro servidor. `whoami` cruza o host.
  }

  function api(ctx, method, path, body) {
    var headers = { 'X-Telegram-Init-Data': (tg && tg.initData) || '' };
    var opts = { method: method, headers: headers, cache: 'no-store' };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(ctx.api.replace(/\/$/, '') + '/v1/miniapp/' + path, opts).then(function (r) {
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    });
  }

  function showFallback(msg) {
    var s = screenNode(); clear(s);
    s.appendChild(el('p', 'err', msg || L.offline));
    var foot = document.getElementById('foot'); foot.hidden = false;
    var btn = document.getElementById('btn-close'); btn.textContent = L.close;
    btn.onclick = function () { if (tg) tg.close(); };
  }

  function setBadge(text) {
    var b = document.getElementById('badge'); b.textContent = text || ''; b.hidden = !text;
  }

  // Registro de telas: plano 01 Task 10 preenche status/config; plano 02 preenche plan/question/permission.
  var SCREENS = {};
  window.GK_SCREENS = SCREENS;

  function renderScreen(ctx) {
    var s = screenNode(); clear(s);
    var fn = SCREENS[ctx.screen];
    if (typeof fn === 'function') { fn(ctx, s, { el: el, clear: clear, api: api, L: L, fallback: showFallback }); return; }
    s.appendChild(el('p', 'muted', ctx.screen ? L.preparing : L.home));
    document.getElementById('foot').hidden = false;
    var btn = document.getElementById('btn-close'); btn.textContent = L.close;
    btn.onclick = function () { if (tg) tg.close(); };
  }

  function boot() {
    if (!tg || !tg.initData) { showFallback(L.notTelegram); return; }
    tg.ready();
    try { tg.expand(); } catch (e) { /* opcional */ }
    document.getElementById('loading').textContent = L.connecting;
    var ctx = parseHash();
    if (!apiOk(ctx.api)) { showFallback(L.badApi); return; }
    api(ctx, 'GET', 'whoami').then(function (who) {
      if (!who || who.ok !== true) throw new Error('whoami');
      if (who.protocol_version !== PROTOCOL_VERSION) { showFallback(L.proto); return; }
      // Cruzamento: o servidor diz qual host publico acredita ser. Divergencia = aborta.
      if (who.api_url && who.api_url.replace(/\/$/, '') !== ctx.api.replace(/\/$/, '')) {
        showFallback(L.badApi); return;
      }
      ctx.who = who;
      setBadge(L[ctx.screen] || '');
      renderScreen(ctx);
    }).catch(function () { showFallback(L.offline); });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
