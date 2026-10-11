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
          back: 'Voltar',
          qUnavailable: 'Pergunta indisponível — responda pelo chat.', qAnswered: 'Esta pergunta já foi respondida.',
          qSend: 'Enviar resposta', qAnswerAll: 'Responda todas as perguntas.',
          qAlreadyChat: 'Já respondida pelo chat.', qSendFail: 'Não foi possível enviar (HTTP ',
          planConfirm: 'Confirmar:',
          permUnavailable: 'Pedido indisponível — decida pelo chat.', permAnswered: 'Este pedido já foi decidido.',
          permAllow: 'Permitir',
          permAlreadyChat: 'Já decidido pelo chat.',
          permAutoOn: 'Ativar automático', permAutoOff: 'Desligar automático',
          permFloorUp: 'Subir piso', permFloorDown: 'Descer piso', permFloorNow: 'Piso atual: ',
          permApplying: 'Aplicando…',
          permStateFail: 'Não foi possível aplicar agora — tente de novo.', retry: 'Tentar de novo',
          actions: 'Ações', emptyActions: 'Nada pendente por aqui agora.',
          newSession: 'Nova sessão',
          kindPermission: 'Permissão', kindQuestion: 'Pergunta', kindPlan: 'Plano',
          kindPermissionSub: 'Uma ferramenta espera sua autorização',
          kindQuestionSub: 'O Claude precisa de uma escolha sua',
          kindPlanSub: 'Um plano aguarda sua aprovação',
          openDecision: 'Abrir', sessionUnknown: 'Sessão',
          permRequest: 'Pedido de permissão', permRisk: 'Risco ',
          permWithNote: 'Permitir com nota…', permDenyNow: 'Negar',
          permDenyNote: 'Negar com motivo…', permTerminal: 'Decidir no terminal',
          permNoteFor: 'Nota para ', send: 'Enviar', backToMenu: 'Voltar',
          moreOptions: 'Mais opções' },
    en: { connecting: 'Connecting…', offline: 'Backend unavailable — answer in chat.',
          close: 'Close', badApi: 'Invalid API address.', notTelegram: 'Open from Telegram.',
          home: 'Home', preparing: 'Screen in preparation — use chat.',
          proto: 'App and server versions differ. Update.',
          status: 'Status', config: 'Settings', plan: 'Plan', question: 'Question', permission: 'Permission',
          back: 'Back',
          qUnavailable: 'Question unavailable — answer in chat.', qAnswered: 'This question was already answered.',
          qSend: 'Send answer', qAnswerAll: 'Answer every question.',
          qAlreadyChat: 'Already answered in chat.', qSendFail: 'Could not send (HTTP ',
          planConfirm: 'Confirm:',
          permUnavailable: 'Request unavailable — decide in chat.', permAnswered: 'This request was already decided.',
          permAllow: 'Allow',
          permAlreadyChat: 'Already decided in chat.',
          permAutoOn: 'Turn autonomous on', permAutoOff: 'Turn autonomous off',
          permFloorUp: 'Raise floor', permFloorDown: 'Lower floor', permFloorNow: 'Current floor: ',
          permApplying: 'Applying…',
          permStateFail: 'Could not apply now — try again.', retry: 'Try again',
          actions: 'Actions', emptyActions: 'Nothing pending here right now.',
          newSession: 'New session',
          kindPermission: 'Permission', kindQuestion: 'Question', kindPlan: 'Plan',
          kindPermissionSub: 'A tool is waiting for your authorization',
          kindQuestionSub: 'Claude needs a choice from you',
          kindPlanSub: 'A plan is waiting for your approval',
          openDecision: 'Open', sessionUnknown: 'Session',
          permRequest: 'Permission request', permRisk: 'Risk ',
          permWithNote: 'Allow with a note…', permDenyNow: 'Deny',
          permDenyNote: 'Deny with a reason…', permTerminal: 'Decide in the terminal',
          permNoteFor: 'Note for ', send: 'Send', backToMenu: 'Back',
          moreOptions: 'More options' }
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
            { t: 'rect', a: { x: 14, y: 4, width: 4, height: 16, fill: 'currentColor', stroke: 'none' } }],
    // Rodada 10: sessão nova (+), live (olho), link entre sessões (dois elos), menu (caret).
    plus: [{ t: 'line', a: { x1: 12, y1: 5, x2: 12, y2: 19 } },
           { t: 'line', a: { x1: 5, y1: 12, x2: 19, y2: 12 } }],
    eye: [{ t: 'path', a: { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' } },
          { t: 'circle', a: { cx: 12, cy: 12, r: 3 } }],
    link: [{ t: 'rect', a: { x: 3, y: 9, width: 9, height: 6, rx: 3 } },
           { t: 'rect', a: { x: 12, y: 9, width: 9, height: 6, rx: 3 } }],
    'chevron-down': [{ t: 'polyline', a: { points: '6,9 12,15 18,9' } }]
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
    var out = { screen: '', card: '', api: '', session: '' };
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
  // montagem de HTML em string — mesma regra ja usada em screens_plan.js e na tela question.
  // Rodada 10 (plannotator, PermissionCard): rótulo, ferramenta e risco como chips, motivo em
  // texto corrido e o comando em monoespaçado quebrável.
  function permissionHeader(h, payload) {
    var card = h.el('section', 'perm-card');
    card.appendChild(iconLabel('p', 'alert-triangle', L.permRequest)).className = 'perm-label';
    var chips = h.el('div', 'perm-chips');
    chips.appendChild(h.el('span', 'perm-chip', payload.tool || '?'));
    var risco = String(payload.tier || '');
    chips.appendChild(h.el('span', 'perm-chip perm-risk-' + risco, L.permRisk + risco));
    card.appendChild(chips);
    if (payload.reason) card.appendChild(h.el('p', 'perm-reason', payload.reason));
    card.appendChild(h.el('pre', 'perm-command', payload.text || ''));
    return card;
  }

  // Rodada 10 (plannotator, DecisionControl): ação primária à esquerda + seta que abre um menu;
  // escolher "com nota" transforma o MESMO elemento no compositor da nota. `itens` =
  // [{code, label, note, tone}]; `enviar(code, nota)` devolve Promise.
  function decisionControl(h, primario, itens, enviar) {
    var caixa = h.el('div', 'decision');
    var linha = h.el('div', 'decision-split');
    var principal = iconLabel('button', 'check', primario.label);
    principal.type = 'button';
    principal.className = 'decision-primary tone-' + (primario.tone || 'success');
    var seta = document.createElement('button');
    seta.type = 'button';
    seta.className = 'decision-caret tone-' + (primario.tone || 'success');
    seta.setAttribute('aria-label', L.moreOptions);
    seta.appendChild(icon('chevron-down'));
    linha.appendChild(principal);
    linha.appendChild(seta);
    caixa.appendChild(linha);
    var painel = h.el('div', 'decision-panel');
    painel.hidden = true;
    caixa.appendChild(painel);
    principal.onclick = function () { enviar(primario.code, ''); };
    seta.onclick = function () { painel.hidden = !painel.hidden; if (!painel.hidden) decisionMenu(h, painel, itens, enviar); };
    return caixa;
  }

  function decisionMenu(h, painel, itens, enviar) {
    clear(painel);
    itens.forEach(function (item) {
      var b = h.el('button', 'decision-item tone-text-' + (item.tone || 'neutral'));
      b.type = 'button';
      b.appendChild(h.el('span', 'decision-item-label', item.label));
      if (item.sub) b.appendChild(h.el('span', 'decision-item-sub', item.sub));
      b.onclick = function () {
        if (item.note) decisionComposer(h, painel, itens, item, enviar);
        else enviar(item.code, '');
      };
      painel.appendChild(b);
    });
  }

  // O compositor ocupa o lugar do menu. Nota vazia não envia: devolve o foco ao campo.
  function decisionComposer(h, painel, itens, item, enviar) {
    clear(painel);
    painel.appendChild(h.el('p', 'decision-composer-title', L.permNoteFor + item.label.replace('…', '')));
    var nota = document.createElement('textarea');
    nota.maxLength = 4000;
    nota.rows = 3;
    painel.appendChild(nota);
    var barra = h.el('div', 'decision-composer-actions');
    var voltar = h.el('button', 'btn-secondary', L.backToMenu);
    voltar.type = 'button';
    voltar.onclick = function () { decisionMenu(h, painel, itens, enviar); };
    var ir = h.el('button', 'btn-primary', L.send);
    ir.type = 'button';
    ir.onclick = function () {
      if (!nota.value.trim()) { nota.focus(); return; }
      enviar(item.code, nota.value);
    };
    barra.appendChild(voltar);
    barra.appendChild(ir);
    painel.appendChild(barra);
    nota.focus();
  }

  // Decisão sem nota pede confirmação (toque acidental custa caro); com nota, o compositor já é
  // o gesto deliberado. A resposta segue pelo mesmo CAS do chat (`cards-answer`).
  function permissionSend(ctx, cardId, rotulos) {
    return function enviar(code, nota) {
      var pronto = nota ? Promise.resolve(true) : new Promise(function (res) {
        tg.showConfirm(L.planConfirm + ' ' + rotulos[code] + '?', res);
      });
      return pronto.then(function (ok) {
        if (!ok) return;
        return api(ctx, 'POST', 'cards-answer/' + encodeURIComponent(cardId), { decision: code, feedback: nota })
          .then(function () { tg.HapticFeedback.notificationOccurred('success'); tg.close(); })
          .catch(function (erro) {
            var status = String((erro && erro.message) || '').replace('http_', '');
            showToast(status === '409' ? L.permAlreadyChat : L.qSendFail + status + ').', 'danger');
          });
      });
    };
  }

  // Componentes compartilhados com screens_plan.js (mesmo controle de decisão nas duas telas).
  window.GK_UI = { decisionControl: decisionControl, backLink: backLink, api: api,
                   showToast: showToast, renderScreen: function (c) { renderScreen(c); } };

  function permissionDecision(ctx, h, cardId, opcoes) {
    var rotulos = { a: L.permAllow, d: L.permDenyNow, l: L.permTerminal };
    var enviar = permissionSend(ctx, cardId, rotulos);
    var tem = function (c) { return opcoes.indexOf(c) >= 0; };
    var itens = [];
    if (tem('a')) itens.push({ code: 'a', label: L.permWithNote, note: true, tone: 'success' });
    if (tem('d')) itens.push({ code: 'd', label: L.permDenyNow, tone: 'danger' });
    if (tem('d')) itens.push({ code: 'd', label: L.permDenyNote, note: true, tone: 'danger' });
    if (tem('l')) itens.push({ code: 'l', label: L.permTerminal, tone: 'neutral' });
    return decisionControl(h, { code: 'a', label: L.permAllow, tone: 'success' }, itens, enviar);
  }

  SCREENS.permission = function (ctx, root, h) {
    root.appendChild(backLink(ctx));
    var cardId = ctx.card || '';
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'cards/' + encodeURIComponent(cardId)).then(function (json) {
      limpar();
      if (json.kind !== 'permission') { root.appendChild(h.el('p', 'err', L.permUnavailable)); return; }
      if (json.state !== 'open') { root.appendChild(h.el('p', 'muted', L.permAnswered)); return; }
      var payload = json.payload || {};
      root.appendChild(permissionHeader(h, payload));
      root.appendChild(permissionDecision(ctx, h, cardId, json.options || []));

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


  // Fase 1 do redesign (plano pos-Arco-C): decisoes pendentes no Decision Inbox (GET pending —
  // leitura, nunca decide nada). Rodada 5: era a Home; migrou pra aba propria "Acoes", agora
  // agrupada por sessao (`sessionId` de cada card, ja existia e era ignorado) e com estado vazio
  // ilustrado em vez de tela em branco quando nao ha nada pendente.
  var KIND_META = {
    permission: { icon: 'shield', title: 'kindPermission', sub: 'kindPermissionSub' },
    question: { icon: 'help-circle', title: 'kindQuestion', sub: 'kindQuestionSub' },
    plan: { icon: 'edit', title: 'kindPlan', sub: 'kindPlanSub' }
  };

  function actionCard(ctx, h, card) {
    var meta = KIND_META[card.kind] || { icon: 'alert-triangle', title: card.kind, sub: '' };
    var box = h.el('button', 'action-card action-card-' + card.kind);
    box.type = 'button';
    var marca = h.el('span', 'action-icon');
    marca.appendChild(h.icon(meta.icon));
    box.appendChild(marca);
    var textos = h.el('span', 'action-texts');
    textos.appendChild(h.el('span', 'action-title', L[meta.title] || meta.title));
    if (meta.sub) textos.appendChild(h.el('span', 'action-sub', L[meta.sub]));
    box.appendChild(textos);
    box.appendChild(h.el('span', 'action-open', L.openDecision));
    box.onclick = function () { renderScreen({ api: ctx.api, who: ctx.who, screen: card.kind, card: card.id }); };
    return box;
  }

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
      // Rodada 10: nome da sessão (pasta) no lugar do id cru; cada card diz o que espera.
      h.api(ctx, 'GET', 'sessions').catch(function () { return {}; }).then(function (r) {
        var nomes = {};
        ((r && r.sessions) || []).forEach(function (s) {
          nomes[s.sessionId] = String(s.cwd || '').split(/[\\/]/).filter(Boolean).pop() || s.name;
        });
        ordem.forEach(function (sessionId) {
          var titulo = (nomes[sessionId] || L.sessionUnknown) + (sessionId ? ' · ' + sessionId.slice(0, 8) : '');
          root.appendChild(h.el('h3', 'group-title', titulo));
          porSessao[sessionId].forEach(function (card) { root.appendChild(actionCard(ctx, h, card)); });
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

  function fabButton() {
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'tab-fab';
    fab.setAttribute('aria-label', L.newSession);
    fab.appendChild(icon('plus'));
    fab.onclick = function () {
      if (currentCtx && typeof window.GK_NEW_SESSION === 'function') {
        window.GK_NEW_SESSION(currentCtx, helpers(currentCtx));
      }
    };
    return fab;
  }

  function renderTabs(activeScreen) {
    var nav = document.getElementById('tabs');
    if (!nav) return;
    if (NAV_SCREENS.indexOf(activeScreen) === -1) { nav.hidden = true; return; }
    clear(nav);
    nav.hidden = false;
    TABS.forEach(function (name, i) {
      // Rodada 10: botão central "+" (sessão nova), elevado acima da barra, entre Ações e Status.
      if (i === 2) nav.appendChild(fabButton());
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

  function helpers(ctx) {
    return { el: el, clear: clear, api: api, L: L, fallback: showFallback, icon: icon,
             iconLabel: iconLabel, skeleton: skeleton, showToast: showToast, go: go,
             every: function (ms, fn) { screenTimers.push(setInterval(fn, ms)); },
             backLink: function () { return backLink(ctx); } };
  }

  // Rodada 10: timers de polling (home 5s, live 3s) vivem só enquanto a tela está aberta.
  var screenTimers = [];
  function stopTimers() {
    screenTimers.forEach(function (id) { clearInterval(id); });
    screenTimers = [];
  }
  function go(screen, extra) {
    var novo = { api: currentCtx.api, who: currentCtx.who, screen: screen, card: '', session: '' };
    for (var k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) novo[k] = extra[k];
    renderScreen(novo);
  }

  function renderScreen(ctx) {
    stopTimers();
    currentCtx = ctx;
    var s = screenNode();
    // Fase 3 do redesign: fade sutil ao trocar de tela — opacidade a 0, troca o conteudo, remove
    // a classe no proximo frame pra a transicao CSS (`--transition-fast`) animar de volta a 1.
    s.classList.add('fading');
    clear(s);
    renderTabs(ctx.screen);
    var fn = SCREENS[ctx.screen];
    if (typeof fn === 'function') { fn(ctx, s, helpers(ctx)); }
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
    }).catch(function () { showFallback(L.offline, boot); });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
