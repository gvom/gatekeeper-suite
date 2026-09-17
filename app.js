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
          homePending: 'Você tem uma decisão pendente:', homeResume: 'Continuar', back: 'Voltar',
          qUnavailable: 'Pergunta indisponível — responda pelo chat.', qAnswered: 'Esta pergunta já foi respondida.',
          qSend: 'Enviar resposta', qAnswerAll: 'Responda todas as perguntas.',
          qAlreadyChat: 'Já respondida pelo chat.', qSendFail: 'Não foi possível enviar (HTTP ',
          planChanged: 'O plano mudou desde que a pergunta foi feita. Decida pelo chat.',
          planFeedback: 'O que deve mudar? (para Modificar)', planWriteWhat: 'Escreva o que deve mudar.',
          planConfirm: 'Confirmar:', planAlreadyChat: 'Já decidido pelo chat.',
          planExecute: 'Executar', planModify: 'Modificar', planAutoReview: 'Auto revisar',
          planJumpToDecision: 'Ir para a decisão',
          permUnavailable: 'Pedido indisponível — decida pelo chat.', permAnswered: 'Este pedido já foi decidido.',
          permTitle: 'Guardian pede confirmação', permTool: 'Ferramenta: ', permTier: ' · risco: ',
          permReason: 'Motivo: ', permAllow: 'Allow', permDeny: 'Deny', permLocal: 'Local',
          permAlreadyChat: 'Já decidido pelo chat.',
          permAutoOn: 'Ativar automático', permAutoOff: 'Desligar automático',
          permFloorUp: 'Subir piso', permFloorDown: 'Descer piso', permFloorNow: 'Piso atual: ',
          permApplying: 'Aplicando…',
          permStateFail: 'Não foi possível aplicar agora — tente de novo.', retry: 'Tentar de novo',
          permFeedback: 'Anotação (opcional)',
          actions: 'Ações', emptyActions: 'Nada pendente por aqui agora.',
          dashFiveHour: '5 horas', dashWeekly: 'Semanal', dashResetsAt: 'Reinicia em ',
          dashNoUsage: 'Sem dados de uso agora.', dashNoSessions: 'Nenhuma sessão ativa agora.',
          dashTokens: 'tokens', dashEstimated: 'estimado', dashPause: 'Pausar',
          dashResume: 'Continuar', dashRunning: 'Executando', dashPaused: 'Pausada',
          dashWaitingReset: 'Esperando reset' },
    en: { connecting: 'Connecting…', offline: 'Backend unavailable — answer in chat.',
          close: 'Close', badApi: 'Invalid API address.', notTelegram: 'Open from Telegram.',
          home: 'Home', preparing: 'Screen in preparation — use chat.',
          proto: 'App and server versions differ. Update.',
          status: 'Status', config: 'Settings', plan: 'Plan', question: 'Question', permission: 'Permission',
          homePending: 'You have a pending decision:', homeResume: 'Continue', back: 'Back',
          qUnavailable: 'Question unavailable — answer in chat.', qAnswered: 'This question was already answered.',
          qSend: 'Send answer', qAnswerAll: 'Answer every question.',
          qAlreadyChat: 'Already answered in chat.', qSendFail: 'Could not send (HTTP ',
          planChanged: 'The plan changed since the question was asked. Decide in chat.',
          planFeedback: 'What should change? (for Modify)', planWriteWhat: 'Write what should change.',
          planConfirm: 'Confirm:', planAlreadyChat: 'Already decided in chat.',
          planExecute: 'Execute', planModify: 'Modify', planAutoReview: 'Auto review',
          planJumpToDecision: 'Jump to decision',
          permUnavailable: 'Request unavailable — decide in chat.', permAnswered: 'This request was already decided.',
          permTitle: 'Guardian asks for confirmation', permTool: 'Tool: ', permTier: ' · risk: ',
          permReason: 'Reason: ', permAllow: 'Allow', permDeny: 'Deny', permLocal: 'Local',
          permAlreadyChat: 'Already decided in chat.',
          permAutoOn: 'Turn autonomous on', permAutoOff: 'Turn autonomous off',
          permFloorUp: 'Raise floor', permFloorDown: 'Lower floor', permFloorNow: 'Current floor: ',
          permApplying: 'Applying…',
          permStateFail: 'Could not apply now — try again.', retry: 'Try again',
          permFeedback: 'Note (optional)',
          actions: 'Actions', emptyActions: 'Nothing pending here right now.',
          dashFiveHour: '5 hours', dashWeekly: 'Weekly', dashResetsAt: 'Resets at ',
          dashNoUsage: 'No usage data right now.', dashNoSessions: 'No active sessions right now.',
          dashTokens: 'tokens', dashEstimated: 'estimated', dashPause: 'Pause',
          dashResume: 'Continue', dashRunning: 'Running', dashPaused: 'Paused',
          dashWaitingReset: 'Waiting for reset' }
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

  // Fase 3 do redesign: icones como SVG inline via DOM (`createElementNS`), nunca montagem de
  // HTML em string — a CSP nao tem `unsafe-inline` e o teste estatico guarda isso. Formas
  // geometricas simples (linha/circulo/poligono), sem path bezier a mao, pra reduzir risco de
  // markup malformado. `currentColor` deixa o icone herdar a cor semantica do botao/texto.
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  var ICON_SHAPES = {
    back: [{ t: 'polyline', a: { points: '15,18 9,12 15,6' } }],
    play: [{ t: 'polygon', a: { points: '6,4 20,12 6,20', fill: 'currentColor', stroke: 'none' } }],
    // Silhueta de lapis (corpo afunilando até a ponta) preenchida, mesmo padrao do `play` --
    // um contorno fino nao lia como lapis em 16px. Deslocamento perpendicular a linha
    // eixo->ponta, nao paralelo a ela (a primeira versao tinha area liquida ZERO -- polygono
    // auto-intersectante, por isso nao aparecia nada).
    edit: [{ t: 'polygon', a: { points: '16.73,2.73 5.73,13.73 4,18 8.27,16.27 19.27,5.27',
                              fill: 'currentColor', stroke: 'none' } }],
    search: [{ t: 'circle', a: { cx: 10, cy: 10, r: 6 } },
             { t: 'line', a: { x1: 21, y1: 21, x2: 15, y2: 15 } }],
    shield: [{ t: 'polygon', a: { points: '12,2 20,6 20,12 12,22 4,12 4,6' } }],
    check: [{ t: 'polyline', a: { points: '4,12 9,17 20,6' } }],
    x: [{ t: 'line', a: { x1: 5, y1: 5, x2: 19, y2: 19 } },
        { t: 'line', a: { x1: 19, y1: 5, x2: 5, y2: 19 } }],
    'help-circle': [{ t: 'circle', a: { cx: 12, cy: 10, r: 7 } },
                    { t: 'line', a: { x1: 12, y1: 18, x2: 12, y2: 18.01 } }],
    'arrow-up': [{ t: 'polyline', a: { points: '6,15 12,9 18,15' } },
                 { t: 'line', a: { x1: 12, y1: 9, x2: 12, y2: 20 } }],
    'arrow-down': [{ t: 'polyline', a: { points: '6,9 12,15 18,9' } },
                   { t: 'line', a: { x1: 12, y1: 4, x2: 12, y2: 15 } }],
    lock: [{ t: 'rect', a: { x: 5, y: 11, width: 14, height: 10, rx: 2 } },
           { t: 'path', a: { d: 'M8 11V7a4 4 0 0 1 8 0v4' } }],
    'alert-triangle': [{ t: 'polygon', a: { points: '12,3 22,20 2,20' } },
                       { t: 'line', a: { x1: 12, y1: 9, x2: 12, y2: 13 } },
                       { t: 'line', a: { x1: 12, y1: 16, x2: 12, y2: 16.01 } }],
    star: [{ t: 'polygon', a: { points: '12,2 15,9 22,9 16.5,13.5 18.5,21 12,17 5.5,21 7.5,13.5 2,9 9,9' } }],
    undo: [{ t: 'path', a: { d: 'M3 10h10a5 5 0 0 1 0 10h-2' } },
           { t: 'polyline', a: { points: '7,6 3,10 7,14' } }],
    // Fase 8 do redesign (Rodada 2): aba Home da barra de navegacao inferior.
    home: [{ t: 'polyline', a: { points: '4,11 12,4 20,11' } },
           { t: 'rect', a: { x: 7, y: 11, width: 10, height: 9 } }],
    // Engrenagem: circulo externo + furo interno + 8 dentes radiais (45 graus entre si).
    gear: [{ t: 'circle', a: { cx: 12, cy: 12, r: 6.5 } },
           { t: 'circle', a: { cx: 12, cy: 12, r: 2.5 } },
           { t: 'line', a: { x1: 18.5, y1: 12, x2: 20.8, y2: 12 } },
           { t: 'line', a: { x1: 16.6, y1: 16.6, x2: 18.2, y2: 18.2 } },
           { t: 'line', a: { x1: 12, y1: 18.5, x2: 12, y2: 20.8 } },
           { t: 'line', a: { x1: 7.4, y1: 16.6, x2: 5.8, y2: 18.2 } },
           { t: 'line', a: { x1: 5.5, y1: 12, x2: 3.2, y2: 12 } },
           { t: 'line', a: { x1: 7.4, y1: 7.4, x2: 5.8, y2: 5.8 } },
           { t: 'line', a: { x1: 12, y1: 5.5, x2: 12, y2: 3.2 } },
           { t: 'line', a: { x1: 16.6, y1: 7.4, x2: 18.2, y2: 5.8 } }],
    // Rodada 5 (dashboard): duas barras verticais preenchidas -- botao Pausar por sessao.
    pause: [{ t: 'rect', a: { x: 6, y: 4, width: 4, height: 16, fill: 'currentColor', stroke: 'none' } },
            { t: 'rect', a: { x: 14, y: 4, width: 4, height: 16, fill: 'currentColor', stroke: 'none' } }]
  };
  function icon(name) {
    var svg = svgEl('svg', { viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      class: 'icon', 'aria-hidden': 'true' });
    (ICON_SHAPES[name] || []).forEach(function (shape) { svg.appendChild(svgEl(shape.t, shape.a)); });
    return svg;
  }
  // Botao/rotulo com icone + texto (nunca so o icone — acessibilidade).
  function iconLabel(tag, name, texto) {
    var n = document.createElement(tag);
    n.appendChild(icon(name));
    n.appendChild(document.createTextNode(' ' + texto));
    return n;
  }

  // Rodada 5 (dashboard): formatadores de exibicao, sem lib externa.
  function formatElapsed(s) {
    if (s == null) return '';
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? (h + 'h ' + m + 'min') : (m + 'min');
  }
  function formatTokens(n) {
    n = Number(n) || 0;
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  }
  function formatResetAt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(lang() === 'pt' ? 'pt-BR' : 'en-US',
      { dateStyle: 'short', timeStyle: 'short' });
  }

  // Fase 3 do redesign: esqueleto de carregamento — substitui a tela em branco entre abrir e o
  // `h.api(...)` resolver. Devolve uma funcao pra remover, chamada no primeiro `.then`/`.catch`.
  function skeleton(root) {
    var wrap = document.createElement('div');
    wrap.className = 'skeleton';
    for (var i = 0; i < 3; i++) {
      var linha = document.createElement('div');
      linha.className = 'skeleton-line';
      wrap.appendChild(linha);
    }
    root.appendChild(wrap);
    return function limpar() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
  }

  // Fase 10 do redesign (Rodada 2): toast proprio no lugar de tg.showAlert -- mensagem
  // informativa (sucesso/falha/validacao) que aparece e some sozinha, sem ser a caixa de dialogo
  // do proprio Telegram (tg.showConfirm CONTINUA nativo -- confirmacao bloqueante nao vira toast).
  var TOAST_ICONS = { success: 'check', danger: 'x', warning: 'alert-triangle' };
  var _toastTimer = null;
  function showToast(msg, kind) {
    var no = document.getElementById('toast');
    if (!no) { no = document.createElement('div'); no.id = 'toast'; document.body.appendChild(no); }
    clear(no);
    // Mesma linguagem do resto do app (Regra da Cor Rara): a cor semantica mora no icone, nunca
    // em faixa/fundo colorido do card inteiro.
    if (TOAST_ICONS[kind]) {
      var ic = icon(TOAST_ICONS[kind]);
      ic.classList.add('toast-icon-' + kind);
      no.appendChild(ic);
    }
    no.appendChild(document.createTextNode(msg));
    no.hidden = false;
    if (_toastTimer) clearTimeout(_toastTimer);
    // Fase 13 do redesign (Rodada 3): 5s (era 2.5s) -- tempo maior pra ler a mensagem.
    _toastTimer = setTimeout(function () { no.hidden = true; }, 5000);
  }

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

  // Fase 3 do redesign: `retry` opcional — quando a falha é plausivelmente temporária (rede,
  // backend fora do ar), oferece tentar de novo sem precisar fechar/reabrir a Mini App.
  function showFallback(msg, retry) {
    var s = screenNode(); clear(s);
    s.appendChild(el('p', 'err', msg || L.offline));
    if (typeof retry === 'function') {
      var tentar = iconLabel('button', 'undo', L.retry);
      tentar.onclick = retry;
      s.appendChild(tentar);
    }
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
  //
  // Fase 4 do redesign: regra fixada pra qualquer tela nova nao misturar por acidente —
  //   `tg.MainButton` (area fixa nativa do Telegram, sempre visivel embaixo): reservado pra UMA
  //   acao so por tela (hoje: `question`, "Enviar resposta" — sempre a mesma acao, decide tudo
  //   de uma vez).
  //   Botoes inline (`bar.appendChild(b)`, dentro do conteudo da tela): reservados pra decisao
  //   com MULTIPLAS opcoes terminais (hoje: `plan` — Execute/Modify/AutoReview; `permission` —
  //   Allow/Deny/Local). Nunca as duas formas pro MESMO fluxo de decisao na mesma tela.
  var SCREENS = {};
  window.GK_SCREENS = SCREENS;

  // Fase 1 do redesign (plano pos-Arco-C): link de volta para a Home nas telas contextuais
  // (plan/question/permission). Nao substitui `tg.close()` — esse continua so em decisao enviada.
  function backLink(ctx) {
    var a = iconLabel('button', 'back', L.back);
    a.className = 'back-link';
    a.type = 'button';
    a.onclick = function () { renderScreen({ api: ctx.api, who: ctx.who, screen: 'home', card: '' }); };
    return a;
  }

  // Fase 5 (Task 4): leitura integral do plano. `window.__planCurrent` guarda o ultimo payload
  // para a Fase 6c (Task 13) acrescentar os botoes de decisao sem refazer o fetch.
  SCREENS.plan = function (ctx, root, h) {
    root.appendChild(backLink(ctx));
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'plan/current').then(function (json) {
      limpar();
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
          bar.id = 'plan-decision-bar';
          // Fase 4 do redesign: plano longo empurra a decisao pra baixo do scroll — um atalho
          // logo apos os metadados rola ate a barra sem precisar descer manualmente.
          if (String(json.plan || '').length > 1500) {
            var jump = iconLabel('button', 'arrow-down', L.planJumpToDecision);
            jump.className = 'btn-neutral';
            jump.onclick = function () { bar.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
            root.insertBefore(jump, body);
          }
          var feedback = document.createElement('textarea');
          feedback.placeholder = L.planFeedback;
          feedback.maxLength = 4000;
          var send = function (value) {
            if (value === 'modify' && !feedback.value.trim()) { showToast(L.planWriteWhat, 'warning'); return; }
            new Promise(function (res) { tg.showConfirm(L.planConfirm + ' ' + value + '?', res); })
              .then(function (ok) {
                if (!ok) return;
                h.api(ctx, 'POST', 'cards-answer/' + encodeURIComponent(ctx.card),
                      { value: value, feedback: feedback.value })
                  .then(function () { tg.HapticFeedback.notificationOccurred('success'); tg.close(); })
                  .catch(function (erro) {
                    var status = String((erro && erro.message) || '').replace('http_', '');
                    if (status === '409') showToast(L.planAlreadyChat, 'danger');
                    else showToast(L.qSendFail + status + ').', 'danger');
                  });
              });
          };
          var planClasses = { execute: 'btn-success', modify: 'btn-neutral', auto_review: 'btn-neutral' };
          var planIcons = { execute: 'play', modify: 'edit', auto_review: 'search' };
          (c.options || []).forEach(function (opt) {
            var texto = opt === 'execute' ? L.planExecute : opt === 'modify' ? L.planModify : L.planAutoReview;
            var b = iconLabel('button', planIcons[opt] || 'play', texto);
            b.className = planClasses[opt] || 'btn-neutral';
            b.onclick = function () { send(opt); };
            bar.appendChild(b);
          });
          root.appendChild(feedback);
          root.appendChild(bar);
        }).catch(function () { /* sem card acessivel: tela fica so leitura, como na Task 4 */ });
      }
    }).catch(function () { limpar(); h.fallback(undefined, function () { renderScreen(ctx); }); });
  };

  // Fase 6b (Task 11): formulario da pergunta, respondido pela Mini App. `ctx.card` vem do
  // fragmento (#screen=question&card=<id>), ja decodificado por `parseHash`.
  SCREENS.question = function (ctx, root, h) {
    root.appendChild(backLink(ctx));
    var cardId = ctx.card || '';
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'cards/' + encodeURIComponent(cardId)).then(function (json) {
      limpar();
      if (json.state !== 'open') { root.appendChild(h.el('p', 'muted', L.qAnswered)); return; }
      var perguntas = (json.payload && json.payload.questions) || [];
      if (json.payload && json.payload.context) {
        root.appendChild(h.el('pre', 'ctx', json.payload.context));
      }
      // Fase 4 do redesign: feedback de validacao inline (marcador por pergunta) e indicador de
      // progresso (com mais de uma pergunta) — antes so se descobria o que faltava ao tentar
      // enviar (tg.showAlert). Aditivo: o alerta final continua como rede de seguranca.
      var progresso = perguntas.length > 1 ? h.el('p', 'meta', '') : null;
      if (progresso) root.appendChild(progresso);
      var form = document.createElement('form');
      var marcadores = [];
      perguntas.forEach(function (q, qi) {
        var fs = document.createElement('fieldset');
        var titulo = (q.header ? q.header + ' — ' : '') + q.question;
        var legend = document.createElement('legend');
        var marcador = document.createElement('span');
        legend.appendChild(marcador);
        legend.appendChild(document.createTextNode(' ' + titulo));
        marcadores.push(marcador);
        fs.appendChild(legend);
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
      function atualizaValidacao() {
        var respondidas = 0;
        perguntas.forEach(function (q, qi) {
          var ok = form.querySelectorAll('input[name="q' + qi + '"]:checked').length > 0;
          if (ok) respondidas += 1;
          h.clear(marcadores[qi]);
          if (ok) marcadores[qi].appendChild(h.icon('check'));
        });
        if (progresso) progresso.textContent = respondidas + ' / ' + perguntas.length;
      }
      form.addEventListener('change', atualizaValidacao);
      atualizaValidacao();
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
        if (!ok) { showToast(L.qAnswerAll, 'warning'); return; }
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
            if (status === '409') showToast(L.qAlreadyChat, 'danger');
            else showToast(L.qSendFail + status + ').', 'danger');
          });
      });
    }).catch(function () { limpar(); root.appendChild(h.el('p', 'err', L.qUnavailable)); });
  };

  // Fase 6d (Task 15): decisao de permissao (allow/deny/local) via card `kind=permission`.
  // `payload.text`/`.tool`/`.tier`/`.reason` sao dados do dono (o comando que ele mesmo digitou,
  // redigido pelo servidor); vao para o DOM so via `h.el`/`textContent` (linha 56), nunca por
  // montagem de HTML em string — mesma regra ja usada em `renderMarkdownInto` e nas telas plan/question.
  SCREENS.permission = function (ctx, root, h) {
    root.appendChild(backLink(ctx));
    var cardId = ctx.card || '';
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'cards/' + encodeURIComponent(cardId)).then(function (json) {
      limpar();
      if (json.kind !== 'permission') { root.appendChild(h.el('p', 'err', L.permUnavailable)); return; }
      if (json.state !== 'open') { root.appendChild(h.el('p', 'muted', L.permAnswered)); return; }
      var payload = json.payload || {};
      root.appendChild(iconLabel('h1', 'shield', L.permTitle));
      root.appendChild(h.el('p', 'meta', L.permTool + payload.tool + L.permTier + payload.tier));
      root.appendChild(h.el('p', null, L.permReason + (payload.reason || '')));
      root.appendChild(h.el('pre', null, payload.text || ''));
      // Fase 12 do redesign (Rodada 2): anotacao de texto livre opcional, mesmo padrao do
      // feedback de plan -- nunca obrigatoria, acompanha a decisao seja qual for o codigo.
      var feedback = document.createElement('textarea');
      feedback.placeholder = L.permFeedback;
      feedback.maxLength = 4000;
      root.appendChild(feedback);
      var bar = document.createElement('div');
      bar.className = 'actions';
      var labels = { a: L.permAllow, d: L.permDeny, l: L.permLocal };
      var permClasses = { a: 'btn-success', d: 'btn-danger', l: 'btn-neutral' };
      var permIcons = { a: 'check', d: 'x', l: 'help-circle' };
      (json.options || []).forEach(function (code) {
        var b = iconLabel('button', permIcons[code] || 'help-circle', labels[code] || code);
        b.className = permClasses[code] || 'btn-neutral';
        b.onclick = function () {
          new Promise(function (res) { tg.showConfirm(L.planConfirm + ' ' + (labels[code] || code) + '?', res); })
            .then(function (ok) {
              if (!ok) return;
              h.api(ctx, 'POST', 'cards-answer/' + encodeURIComponent(cardId),
                    { decision: code, feedback: feedback.value })
                .then(function () { tg.HapticFeedback.notificationOccurred('success'); tg.close(); })
                .catch(function (erro) {
                  var status = String((erro && erro.message) || '').replace('http_', '');
                  if (status === '409') showToast(L.permAlreadyChat, 'danger');
                  else showToast(L.qSendFail + status + ').', 'danger');
                });
            });
        };
        bar.appendChild(b);
      });
      root.appendChild(bar);

      // Fase 2 do redesign de UX: paridade do modo autonomo (A/U/B/C do chat). Nao decide nada
      // (POST cards-action/<id>, canal separado do CAS acima) — so ativa/desliga o modo ou move
      // o piso, e a tela reconsulta o card pra mostrar o estado resultante.
      var estado = { auto: !!payload.auto, floor: String(payload.floor || 'strict') };
      var stateBar = document.createElement('div');
      stateBar.className = 'actions state-actions';
      var floorLabel = h.el('p', 'meta', '');
      var autoBtn = document.createElement('button');
      var upBtn = iconLabel('button', 'arrow-up', L.permFloorUp);
      var downBtn = iconLabel('button', 'arrow-down', L.permFloorDown);

      function refreshEstado(auto, floor) {
        estado.auto = !!auto;
        if (floor) estado.floor = String(floor);
        clear(autoBtn);
        autoBtn.appendChild(icon(estado.auto ? 'x' : 'play'));
        autoBtn.appendChild(document.createTextNode(' ' + (estado.auto ? L.permAutoOff : L.permAutoOn)));
        floorLabel.textContent = L.permFloorNow + estado.floor;
      }
      function setBusy(v) {
        autoBtn.disabled = v; upBtn.disabled = v; downBtn.disabled = v;
        if (v) floorLabel.textContent = L.permApplying;
      }
      // O laco que aplica a acao (gatekeeper.py) leva uns 5-10s de verdade (varias voltas do
      // proprio polling do Telegram). Poucas tentativas bem espacadas: espera o suficiente pra
      // maioria dos casos, sem multiplicar requisicoes contra o limite de taxa
      // (`ANON_LIMIT_PER_MIN`, `api_server.py`) como uma reconsulta em intervalo curto faria.
      function pollAteAplicar(tentativas, atraso) {
        return new Promise(function (res) { setTimeout(res, atraso); })
          .then(function () { return h.api(ctx, 'GET', 'cards/' + encodeURIComponent(cardId)); })
          .then(function (json2) {
            if (json2.pending_state_action && tentativas > 0) {
              return pollAteAplicar(tentativas - 1, 3000);
            }
            return json2;
          });
      }
      function sendState(code) {
        setBusy(true);
        h.api(ctx, 'POST', 'cards-action/' + encodeURIComponent(cardId), { action: code })
          .then(function () { return pollAteAplicar(2, 6000); })
          .then(function (json2) {
            var p2 = json2.payload || {};
            refreshEstado(p2.auto, p2.floor);
          })
          .catch(function () { showToast(L.permStateFail, 'danger'); refreshEstado(estado.auto, estado.floor); })
          .then(function () { setBusy(false); });
      }
      autoBtn.onclick = function () { sendState(estado.auto ? 'C' : 'A'); };
      upBtn.onclick = function () { sendState('U'); };
      downBtn.onclick = function () { sendState('B'); };
      refreshEstado(payload.auto, payload.floor);
      root.appendChild(floorLabel);
      stateBar.appendChild(autoBtn);
      stateBar.appendChild(upBtn);
      stateBar.appendChild(downBtn);
      root.appendChild(stateBar);
    }).catch(function () { limpar(); h.fallback(undefined, function () { renderScreen(ctx); }); });
  };

  var DASH_STATUS_LABELS = { running: 'dashRunning', paused: 'dashPaused',
                            waiting_reset: 'dashWaitingReset' };

  function dashUsageCard(h, titulo, janela) {
    var card = h.el('div', 'card');
    card.appendChild(h.el('p', null, titulo));
    if (!janela || janela.utilization == null) {
      card.appendChild(h.el('p', 'muted', L.dashNoUsage));
      return card;
    }
    var pct = Math.max(0, Math.min(100, Number(janela.utilization) || 0));
    var trilha = h.el('div', 'usage-bar');
    var preenchido = h.el('div', 'usage-bar-fill');
    preenchido.style.width = pct + '%';
    preenchido.style.background = pct >= 90 ? 'var(--danger)' : (pct >= 70 ? 'var(--warning)' : 'var(--success)');
    trilha.appendChild(preenchido);
    card.appendChild(trilha);
    var legenda = pct.toFixed(0) + '%' +
      (janela.resetsAt ? ' · ' + L.dashResetsAt + formatResetAt(janela.resetsAt) : '');
    card.appendChild(h.el('p', 'muted', legenda));
    return card;
  }

  function dashSessionCard(ctx, root, h, s) {
    var card = h.el('div', 'card');
    var head = h.el('div', 'session-card-head');
    head.appendChild(h.el('span', 'session-card-goal', s.goal || s.sessionId));
    head.appendChild(h.el('span', 'status-pill status-pill-' + s.status,
      L[DASH_STATUS_LABELS[s.status]] || s.status));
    card.appendChild(head);
    var meta = h.el('div', 'session-meta');
    if (s.elapsedS != null) meta.appendChild(h.el('span', null, formatElapsed(s.elapsedS)));
    meta.appendChild(h.el('span', null, formatTokens(s.tokens) + ' ' + L.dashTokens));
    if (s.estimatedPercent != null) {
      meta.appendChild(h.el('span', null, s.estimatedPercent.toFixed(1) + '% (' + L.dashEstimated + ')'));
    }
    card.appendChild(meta);
    // Pedido original: botao pausar/continuar so aparece quando a sessao NAO esta esperando o
    // reset do limite (pausa GLOBAL do Governor -- nada que o botao por sessao resolveria).
    if (s.status !== 'waiting_reset') {
      var pausada = s.status === 'paused';
      var btn = h.iconLabel('button', pausada ? 'play' : 'pause', pausada ? L.dashResume : L.dashPause);
      btn.onclick = function () {
        btn.disabled = true;
        var rota = (pausada ? 'sessions-resume/' : 'sessions-pause/') + encodeURIComponent(s.sessionId);
        h.api(ctx, 'POST', rota, {}).then(function () {
          SCREENS.home(ctx, root, h);
        }).catch(function () { btn.disabled = false; h.showToast(L.permStateFail, 'danger'); });
      };
      card.appendChild(btn);
    }
    return card;
  }

  // Rodada 5: a tela inicial vira um dashboard de uso/sessoes -- `GET dashboard` (Fase 3) ja
  // agrega tudo numa chamada so (janelas de uso REAIS da conta + sessoes ativas com
  // status/tempo/tokens/% estimado), o cliente so desenha.
  SCREENS.home = function (ctx, root, h) {
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'dashboard').then(function (resp) {
      limpar();
      if (!resp || resp.ok !== true) { h.fallback(undefined, function () { SCREENS.home(ctx, root, h); }); return; }
      var usage = resp.usage || {};
      root.appendChild(dashUsageCard(h, L.dashFiveHour, usage.fiveHour));
      root.appendChild(dashUsageCard(h, L.dashWeekly, usage.sevenDay));
      var sessoes = resp.sessions || [];
      if (!sessoes.length) { root.appendChild(h.el('p', 'muted', L.dashNoSessions)); return; }
      sessoes.forEach(function (s) { root.appendChild(dashSessionCard(ctx, root, h, s)); });
    }).catch(function () { limpar(); h.fallback(undefined, function () { SCREENS.home(ctx, root, h); }); });
  };

  // Fase 1 do redesign (plano pos-Arco-C): decisoes pendentes no Decision Inbox (GET pending —
  // leitura, nunca decide nada). Rodada 5: era a Home; migrou pra aba propria "Acoes", agora
  // agrupada por sessao (`sessionId` de cada card, ja existia e era ignorado) e com estado vazio
  // ilustrado em vez de tela em branco quando nao ha nada pendente.
  SCREENS.actions = function (ctx, root, h) {
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'pending').then(function (resp) {
      limpar();
      var cards = (resp && resp.cards) || [];
      if (!cards.length) {
        var vazio = h.el('div', 'empty-state');
        var img = document.createElement('img');
        img.src = 'empty.svg';
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        vazio.appendChild(img);
        vazio.appendChild(h.el('p', 'muted', L.emptyActions));
        root.appendChild(vazio);
        return;
      }
      var porSessao = {}, ordem = [];
      cards.forEach(function (card) {
        var chave = card.sessionId || '';
        if (!(chave in porSessao)) { porSessao[chave] = []; ordem.push(chave); }
        porSessao[chave].push(card);
      });
      ordem.forEach(function (sessionId) {
        if (sessionId) root.appendChild(h.el('p', 'muted', sessionId));
        porSessao[sessionId].forEach(function (card) {
          var box = h.el('div', 'card');
          box.appendChild(h.el('p', null, L.homePending));
          var btn = document.createElement('button');
          btn.textContent = L.homeResume + ' — ' + (L[card.kind] || card.kind);
          btn.onclick = function () {
            renderScreen({ api: ctx.api, who: ctx.who, screen: card.kind, card: card.id });
          };
          box.appendChild(btn);
          root.appendChild(box);
        });
      });
    }).catch(function () { limpar(); h.fallback(undefined, function () { SCREENS.actions(ctx, root, h); }); });
  };

  // Fase 1 do redesign (plano pos-Arco-C): shell de navegacao. `home`/`status`/`config` sao as
  // telas "de navegacao" (mostram a barra de abas); `plan`/`question`/`permission` sao
  // contextuais (abertas so por um card especifico) e escondem a barra.
  // Rodada 5: "home" virou o dashboard de uso/sessoes; "actions" (as decisoes pendentes que
  // costumavam morar na Home) ganha aba propria.
  var NAV_SCREENS = ['home', 'actions', 'status', 'config'];
  var TABS = ['home', 'actions', 'status', 'config'];
  // Fase 8 do redesign (Rodada 2): icone por aba — status/config reaproveitam icones ja usados
  // em outro contexto (shield no titulo de permission, edit em "Modificar" plano); sempre
  // acompanhados do rotulo (iconLabel), entao a reutilizacao nao gera ambiguidade. Rodada 5:
  // "actions" reaproveita 'check' (mesma logica).
  var TAB_ICONS = { home: 'home', actions: 'check', status: 'shield', config: 'gear' };
  var currentCtx = null;

  function renderTabs(activeScreen) {
    var nav = document.getElementById('tabs');
    if (!nav) return;
    if (NAV_SCREENS.indexOf(activeScreen) === -1) { nav.hidden = true; return; }
    clear(nav);
    nav.hidden = false;
    TABS.forEach(function (name) {
      var btn = iconLabel('button', TAB_ICONS[name] || name, L[name] || name);
      btn.type = 'button';
      btn.className = 'tab' + (name === activeScreen ? ' tab-active' : '');
      btn.onclick = function () {
        if (name === activeScreen || !currentCtx) return;
        renderScreen({ api: currentCtx.api, who: currentCtx.who, screen: name, card: '' });
      };
      nav.appendChild(btn);
    });
  }

  function renderScreen(ctx) {
    currentCtx = ctx;
    var s = screenNode();
    // Fase 3 do redesign: fade sutil ao trocar de tela — opacidade a 0, troca o conteudo, remove
    // a classe no proximo frame pra a transicao CSS (`--transition-fast`) animar de volta a 1.
    s.classList.add('fading');
    clear(s);
    renderTabs(ctx.screen);
    var fn = SCREENS[ctx.screen];
    if (typeof fn === 'function') { fn(ctx, s, { el: el, clear: clear, api: api, L: L, fallback: showFallback, icon: icon, iconLabel: iconLabel, skeleton: skeleton, showToast: showToast }); }
    else {
      s.appendChild(el('p', 'muted', L.preparing));
      document.getElementById('foot').hidden = false;
      var btn = document.getElementById('btn-close'); btn.textContent = L.close;
      btn.onclick = function () { if (tg) tg.close(); };
    }
    requestAnimationFrame(function () { s.classList.remove('fading'); });
  }

  function boot() {
    if (!tg || !tg.initData) { showFallback(L.notTelegram); return; }
    tg.ready();
    try { tg.expand(); } catch (e) { /* opcional */ }
    document.getElementById('loading').textContent = L.connecting;
    var ctx = parseHash();
    if (!apiOk(ctx.api)) { showFallback(L.badApi + ' [hash=' + JSON.stringify(location.hash) + ']'); return; }
    api(ctx, 'GET', 'whoami').then(function (who) {
      if (!who || who.ok !== true) throw new Error('whoami');
      if (who.protocol_version !== PROTOCOL_VERSION) { showFallback(L.proto); return; }
      // Cruzamento: o servidor diz qual host publico acredita ser. Divergencia = aborta.
      if (who.api_url && who.api_url.replace(/\/$/, '') !== ctx.api.replace(/\/$/, '')) {
        showFallback(L.badApi + ' [who=' + JSON.stringify(who.api_url) + ' ctx=' + JSON.stringify(ctx.api) + ']');
        return;
      }
      ctx.who = who;
      // Fase 1 do redesign: Menu Button abre sem #screen — a Home passa a ser o destino default
      // em vez do antigo texto morto "Mini App conectada.".
      if (!ctx.screen) ctx.screen = 'home';
      setBadge(L[ctx.screen] || '');
      renderScreen(ctx);
    }).catch(function () { showFallback(L.offline, boot); });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
