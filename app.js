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
          home: 'Início', preparing: 'Tela em preparação — use o chat.',
          proto: 'Versão do app e do servidor não batem. Atualize.',
          status: 'Status', config: 'Configuração', plan: 'Plano', question: 'Pergunta', permission: 'Permissão',
          homePending: 'Você tem uma decisão pendente:', homeResume: 'Continuar', back: '← Voltar',
          qUnavailable: 'Pergunta indisponível — responda pelo chat.', qAnswered: 'Esta pergunta já foi respondida.',
          qSend: 'Enviar resposta', qAnswerAll: 'Responda todas as perguntas.',
          qAlreadyChat: 'Já respondida pelo chat.', qSendFail: 'Não foi possível enviar (HTTP ',
          planChanged: 'O plano mudou desde que a pergunta foi feita. Decida pelo chat.',
          planFeedback: 'O que deve mudar? (para Modificar)', planWriteWhat: 'Escreva o que deve mudar.',
          planConfirm: 'Confirmar:', planAlreadyChat: 'Já decidido pelo chat.',
          planExecute: '▶ Executar', planModify: '✏ Modificar', planAutoReview: '🔍 Auto revisar',
          permUnavailable: 'Pedido indisponível — decida pelo chat.', permAnswered: 'Este pedido já foi decidido.',
          permTitle: '🛡 Guardian pede confirmação', permTool: 'Ferramenta: ', permTier: ' · risco: ',
          permReason: 'Motivo: ', permAllow: '✅ Allow', permDeny: '❌ Deny', permLocal: '🤔 Local',
          permAlreadyChat: 'Já decidido pelo chat.' },
    en: { connecting: 'Connecting…', offline: 'Backend unavailable — answer in chat.',
          close: 'Close', badApi: 'Invalid API address.', notTelegram: 'Open from Telegram.',
          home: 'Home', preparing: 'Screen in preparation — use chat.',
          proto: 'App and server versions differ. Update.',
          status: 'Status', config: 'Settings', plan: 'Plan', question: 'Question', permission: 'Permission',
          homePending: 'You have a pending decision:', homeResume: 'Continue', back: '← Back',
          qUnavailable: 'Question unavailable — answer in chat.', qAnswered: 'This question was already answered.',
          qSend: 'Send answer', qAnswerAll: 'Answer every question.',
          qAlreadyChat: 'Already answered in chat.', qSendFail: 'Could not send (HTTP ',
          planChanged: 'The plan changed since the question was asked. Decide in chat.',
          planFeedback: 'What should change? (for Modify)', planWriteWhat: 'Write what should change.',
          planConfirm: 'Confirm:', planAlreadyChat: 'Already decided in chat.',
          planExecute: '▶ Execute', planModify: '✏ Modify', planAutoReview: '🔍 Auto review',
          permUnavailable: 'Request unavailable — decide in chat.', permAnswered: 'This request was already decided.',
          permTitle: '🛡 Guardian asks for confirmation', permTool: 'Tool: ', permTier: ' · risk: ',
          permReason: 'Reason: ', permAllow: '✅ Allow', permDeny: '❌ Deny', permLocal: '🤔 Local',
          permAlreadyChat: 'Already decided in chat.' }
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

  // Render de markdown MINIMO e seguro: paragrafos, titulos (#), listas (-/*) e blocos ```.
  // Tudo via textContent/createElement — nunca monta HTML por string: o plano e texto do dono,
  // mas passa por um webview publico e a CSP nao tem unsafe-inline.
  function renderMarkdownInto(root, text) {
    var lines = String(text || '').split(/\r?\n/);
    var pre = null;
    var list = null;
    lines.forEach(function (line) {
      if (line.indexOf('```') === 0) {
        if (pre) { root.appendChild(pre); pre = null; }
        else { list = null; pre = document.createElement('pre'); }
        return;
      }
      if (pre) { pre.textContent += line + '\n'; return; }
      var titulo = /^(#{1,6})\s+(.*)$/.exec(line);
      if (titulo) {
        list = null;
        var elTitulo = document.createElement('h' + Math.min(6, titulo[1].length + 1));
        elTitulo.textContent = titulo[2]; root.appendChild(elTitulo);
        return;
      }
      var item = /^\s*[-*]\s+(.*)$/.exec(line);
      if (item) {
        if (!list) { list = document.createElement('ul'); root.appendChild(list); }
        var li = document.createElement('li'); li.textContent = item[1]; list.appendChild(li);
        return;
      }
      list = null;
      if (line.trim() === '') return;
      var p = document.createElement('p'); p.textContent = line; root.appendChild(p);
    });
    if (pre) root.appendChild(pre);
  }

  // Registro de telas: plano 01 Task 10 preenche status/config; plano 02 preenche plan/question/permission.
  var SCREENS = {};
  window.GK_SCREENS = SCREENS;

  // Fase 1 do redesign (plano pos-Arco-C): link de volta para a Home nas telas contextuais
  // (plan/question/permission). Nao substitui `tg.close()` — esse continua so em decisao enviada.
  function backLink(ctx) {
    var a = el('button', 'back-link', L.back);
    a.type = 'button';
    a.onclick = function () { renderScreen({ api: ctx.api, who: ctx.who, screen: 'home', card: '' }); };
    return a;
  }

  // Fase 5 (Task 4): leitura integral do plano. `window.__planCurrent` guarda o ultimo payload
  // para a Fase 6c (Task 13) acrescentar os botoes de decisao sem refazer o fetch.
  SCREENS.plan = function (ctx, root, h) {
    root.appendChild(backLink(ctx));
    h.api(ctx, 'GET', 'plan/current').then(function (json) {
      var meta = h.el('p', 'meta', 'Rodada ' + json.round + ' · hash ' +
        String(json.hash).slice(0, 12) + ' · ' + json.plan.length + ' caracteres');
      root.appendChild(meta);
      var body = document.createElement('article');
      renderMarkdownInto(body, json.plan);
      root.appendChild(body);
      window.__planCurrent = json;
      // Fase 6c (Task 13): botoes de decisao quando o link veio de um card `kind=plan` aberto.
      if (ctx.card) {
        h.api(ctx, 'GET', 'cards/' + encodeURIComponent(ctx.card)).then(function (c) {
          if (c.state !== 'open' || c.kind !== 'plan') return;
          if (c.payload && c.payload.hash && c.payload.hash !== json.hash) {
            root.appendChild(h.el('p', 'warn', L.planChanged));
            return;
          }
          var bar = document.createElement('div');
          bar.className = 'actions';
          var feedback = document.createElement('textarea');
          feedback.placeholder = L.planFeedback;
          feedback.maxLength = 4000;
          var send = function (value) {
            if (value === 'modify' && !feedback.value.trim()) { tg.showAlert(L.planWriteWhat); return; }
            new Promise(function (res) { tg.showConfirm(L.planConfirm + ' ' + value + '?', res); })
              .then(function (ok) {
                if (!ok) return;
                h.api(ctx, 'POST', 'cards-answer/' + encodeURIComponent(ctx.card),
                      { value: value, feedback: feedback.value })
                  .then(function () { tg.HapticFeedback.notificationOccurred('success'); tg.close(); })
                  .catch(function (erro) {
                    var status = String((erro && erro.message) || '').replace('http_', '');
                    if (status === '409') tg.showAlert(L.planAlreadyChat);
                    else tg.showAlert(L.qSendFail + status + ').');
                  });
              });
          };
          (c.options || []).forEach(function (opt) {
            var b = document.createElement('button');
            b.textContent = opt === 'execute' ? L.planExecute : opt === 'modify' ? L.planModify : L.planAutoReview;
            b.onclick = function () { send(opt); };
            bar.appendChild(b);
          });
          root.appendChild(feedback);
          root.appendChild(bar);
        }).catch(function () { /* sem card acessivel: tela fica so leitura, como na Task 4 */ });
      }
    }).catch(function () { h.fallback(); });
  };

  // Fase 6b (Task 11): formulario da pergunta, respondido pela Mini App. `ctx.card` vem do
  // fragmento (#screen=question&card=<id>), ja decodificado por `parseHash`.
  SCREENS.question = function (ctx, root, h) {
    root.appendChild(backLink(ctx));
    var cardId = ctx.card || '';
    h.api(ctx, 'GET', 'cards/' + encodeURIComponent(cardId)).then(function (json) {
      if (json.state !== 'open') { root.appendChild(h.el('p', 'muted', L.qAnswered)); return; }
      var perguntas = (json.payload && json.payload.questions) || [];
      if (json.payload && json.payload.context) {
        root.appendChild(h.el('pre', 'ctx', json.payload.context));
      }
      var form = document.createElement('form');
      perguntas.forEach(function (q, qi) {
        var fs = document.createElement('fieldset');
        var titulo = (q.header ? q.header + ' — ' : '') + q.question;
        fs.appendChild(h.el('legend', null, titulo));
        (q.options || []).forEach(function (o, oi) {
          var label = document.createElement('label');
          var input = document.createElement('input');
          input.type = q.multiSelect ? 'checkbox' : 'radio';
          input.name = 'q' + qi; input.value = String(oi);
          label.appendChild(input);
          var texto = ' ' + o.label + (o.description ? ' — ' + o.description : '');
          label.appendChild(document.createTextNode(texto));
          fs.appendChild(label);
        });
        form.appendChild(fs);
      });
      root.appendChild(form);
      var mb = tg && tg.MainButton;
      if (!mb) return;
      mb.setText(L.qSend);
      mb.show();
      mb.onClick(function () {
        var answers = {};
        var ok = true;
        perguntas.forEach(function (q, qi) {
          var marcados = Array.prototype.slice
            .call(form.querySelectorAll('input[name="q' + qi + '"]:checked'))
            .map(function (i) { return Number(i.value); });
          if (!marcados.length) ok = false;
          answers[String(qi)] = marcados;
        });
        if (!ok) { tg.showAlert(L.qAnswerAll); return; }
        mb.showProgress();
        h.api(ctx, 'POST', 'cards-answer/' + encodeURIComponent(cardId), { answers: answers })
          .then(function () {
            mb.hideProgress();
            tg.HapticFeedback.notificationOccurred('success');
            tg.close();
          })
          .catch(function (erro) {
            mb.hideProgress();
            var status = String((erro && erro.message) || '').replace('http_', '');
            if (status === '409') tg.showAlert(L.qAlreadyChat);
            else tg.showAlert(L.qSendFail + status + ').');
          });
      });
    }).catch(function () { root.appendChild(h.el('p', 'err', L.qUnavailable)); });
  };

  // Fase 6d (Task 15): decisao de permissao (allow/deny/local) via card `kind=permission`.
  // `payload.text`/`.tool`/`.tier`/`.reason` sao dados do dono (o comando que ele mesmo digitou,
  // redigido pelo servidor); vao para o DOM so via `h.el`/`textContent` (linha 56), nunca por
  // montagem de HTML em string — mesma regra ja usada em `renderMarkdownInto` e nas telas plan/question.
  SCREENS.permission = function (ctx, root, h) {
    root.appendChild(backLink(ctx));
    var cardId = ctx.card || '';
    h.api(ctx, 'GET', 'cards/' + encodeURIComponent(cardId)).then(function (json) {
      if (json.kind !== 'permission') { root.appendChild(h.el('p', 'err', L.permUnavailable)); return; }
      if (json.state !== 'open') { root.appendChild(h.el('p', 'muted', L.permAnswered)); return; }
      var payload = json.payload || {};
      root.appendChild(h.el('h1', null, L.permTitle));
      root.appendChild(h.el('p', 'meta', L.permTool + payload.tool + L.permTier + payload.tier));
      root.appendChild(h.el('p', null, L.permReason + (payload.reason || '')));
      root.appendChild(h.el('pre', null, payload.text || ''));
      var bar = document.createElement('div');
      bar.className = 'actions';
      var labels = { a: L.permAllow, d: L.permDeny, l: L.permLocal };
      (json.options || []).forEach(function (code) {
        var b = document.createElement('button');
        b.textContent = labels[code] || code;
        b.onclick = function () {
          new Promise(function (res) { tg.showConfirm(L.planConfirm + ' ' + (labels[code] || code) + '?', res); })
            .then(function (ok) {
              if (!ok) return;
              h.api(ctx, 'POST', 'cards-answer/' + encodeURIComponent(cardId), { decision: code })
                .then(function () { tg.HapticFeedback.notificationOccurred('success'); tg.close(); })
                .catch(function (erro) {
                  var status = String((erro && erro.message) || '').replace('http_', '');
                  if (status === '409') tg.showAlert(L.permAlreadyChat);
                  else tg.showAlert(L.qSendFail + status + ').');
                });
            });
        };
        bar.appendChild(b);
      });
      root.appendChild(bar);
    }).catch(function () { h.fallback(); });
  };

  // Fase 1 do redesign (plano pos-Arco-C): tela inicial quando a Mini App abre sem `#screen`
  // (Menu Button do Telegram). Mostra um resumo do status e, se houver, um atalho para retomar
  // uma decisao em aberto no Decision Inbox (GET pending — leitura, nunca decide nada).
  SCREENS.home = function (ctx, root, h) {
    h.api(ctx, 'GET', 'status').then(function (resp) {
      var s = (resp && resp.status) || {};
      root.appendChild(h.el('p', 'muted', s.state || '?'));
    }).catch(function () { /* resumo e so um extra; a Home continua util sem ele */ });
    h.api(ctx, 'GET', 'pending').then(function (resp) {
      var card = resp && resp.card;
      if (!card) return;
      var box = document.createElement('div');
      box.className = 'card';
      box.appendChild(h.el('p', null, L.homePending));
      var btn = document.createElement('button');
      btn.textContent = L.homeResume + ' — ' + (L[card.kind] || card.kind);
      btn.onclick = function () {
        renderScreen({ api: ctx.api, who: ctx.who, screen: card.kind, card: card.id });
      };
      box.appendChild(btn);
      root.appendChild(box);
    }).catch(function () { /* sem pendencia detectavel: Home segue normal */ });
  };

  // Fase 1 do redesign (plano pos-Arco-C): shell de navegacao. `home`/`status`/`config` sao as
  // telas "de navegacao" (mostram a barra de abas); `plan`/`question`/`permission` sao
  // contextuais (abertas so por um card especifico) e escondem a barra.
  var NAV_SCREENS = ['home', 'status', 'config'];
  var TABS = ['status', 'config'];
  var currentCtx = null;

  function renderTabs(activeScreen) {
    var nav = document.getElementById('tabs');
    if (!nav) return;
    if (NAV_SCREENS.indexOf(activeScreen) === -1) { nav.hidden = true; return; }
    clear(nav);
    nav.hidden = false;
    TABS.forEach(function (name) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab' + (name === activeScreen ? ' tab-active' : '');
      btn.textContent = L[name] || name;
      btn.onclick = function () {
        if (name === activeScreen || !currentCtx) return;
        renderScreen({ api: currentCtx.api, who: currentCtx.who, screen: name, card: '' });
      };
      nav.appendChild(btn);
    });
  }

  function renderScreen(ctx) {
    currentCtx = ctx;
    var s = screenNode(); clear(s);
    renderTabs(ctx.screen);
    var fn = SCREENS[ctx.screen];
    if (typeof fn === 'function') { fn(ctx, s, { el: el, clear: clear, api: api, L: L, fallback: showFallback }); return; }
    s.appendChild(el('p', 'muted', L.preparing));
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
      // Fase 1 do redesign: Menu Button abre sem #screen — a Home passa a ser o destino default
      // em vez do antigo texto morto "Mini App conectada.".
      if (!ctx.screen) ctx.screen = 'home';
      setBadge(L[ctx.screen] || '');
      renderScreen(ctx);
    }).catch(function () { showFallback(L.offline); });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
