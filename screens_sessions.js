/* Sessões (Rodada 10): home com as sessões abertas agora, tela live por sessão, botão "+" de
 * sessão nova e links entre sessões. Registra-se em window.GK_SCREENS (definido por app.js).
 * Mesmas regras do resto da Mini App: todo texto via textContent, nunca HTML por string. */
(function () {
  'use strict';
  var S = window.GK_SCREENS;
  if (!S) return;
  var tg = window.Telegram && window.Telegram.WebApp;

  var T = {
    pt: { usage5h: 'Janela de 5 horas', usageWeek: 'Janela semanal', resetsAt: 'reinicia ',
          noUsage: 'Sem dados de uso agora.', noSessions: 'Nenhuma sessão aberta agora.',
          noSessionsHint: 'Abra o Claude Code num terminal ou toque em + para começar uma.',
          busy: 'Executando', idle: 'Parada', waiting: 'Aguardando você', unknown: 'Sem sinal',
          paused: 'Pausada', waitingReset: 'Esperando reset do limite',
          auto: 'Modo autônomo', manual: 'Manual', floor: 'Piso', live: 'Live',
          pinned: 'fixado pelo projeto', tokens: 'tokens', estimated: 'estimado',
          play: 'Continuar', pause: 'Pausar', resume: 'Retomar', openLive: 'Ver live',
          link: 'Vincular', linked: 'Vinculada a ', unlink: 'Desvincular',
          floorStrict: 'strict — só o seguro passa sozinho',
          floorBalanced: 'balanced — riscos médios passam',
          floorOpen: 'open — quase tudo passa sozinho',
          lowerFloorQ: 'Baixar o piso desta sessão para ', confirmQ: '?',
          autoOnQ: 'Ligar o modo autônomo nesta sessão?',
          playTitle: 'Próximo prompt', playHint: 'Vai como se você tivesse digitado no terminal desta sessão.',
          send: 'Enviar', cancel: 'Cancelar', sent: 'Enviado. A sessão começa em instantes.',
          notIdle: 'A sessão voltou a trabalhar; espere ela parar.',
          fail: 'Não deu certo agora (', failEnd: '). Tente de novo.',
          liveTitle: 'Live', liveOff: 'O live desta sessão está desligado.', liveEmpty: 'Nada no terminal ainda.',
          liveUpdated: 'atualizado ', back: 'Voltar',
          newTitle: 'Nova sessão', newFolder: 'Pasta do projeto', newPrompt: 'O que a sessão deve fazer?',
          newOpen: 'Abrir terminal', newOpened: 'Terminal aberto. A sessão aparece aqui em instantes.',
          newDisabled: 'Abrir sessão pelo celular está desligado. Ligue no computador com:',
          newEnableCmd: 'gatekeeper-suite configure --set GATEKEEPER_MINIAPP_SPAWN=true',
          newNoDirs: 'Nenhuma pasta conhecida ainda. Abra uma sessão no computador uma vez, ou fixe pastas em GATEKEEPER_MINIAPP_SPAWN_DIRS.',
          newManual: 'A sessão nova começa em modo manual.',
          linkTitle: 'Vincular sessão', linkLocal: 'Outra sessão deste computador',
          linkCreate: 'Vincular', linkCreated: 'Sessões vinculadas.',
          linkInvite: 'Convite para outro computador', linkInviteMake: 'Gerar convite',
          linkInviteHint: 'Abra a Mini App do outro computador e cole em "Aceitar convite". Vale 10 minutos e uma vez.',
          linkCopy: 'Copiar', linkCopied: 'Copiado.',
          linkAccept: 'Aceitar convite', linkAcceptPlaceholder: 'Cole o código do convite',
          linkAccepted: 'Vínculo com o outro computador criado.',
          linkNone: 'Nenhuma outra sessão aberta neste computador.',
          linkHow: 'As duas sessões ganham a ferramenta link_send para trocar mensagens.',
          unlinkQ: 'Desvincular esta sessão?', unlinked: 'Vínculo encerrado.' },
    en: { usage5h: '5-hour window', usageWeek: 'Weekly window', resetsAt: 'resets ',
          noUsage: 'No usage data right now.', noSessions: 'No session open right now.',
          noSessionsHint: 'Open Claude Code in a terminal or tap + to start one.',
          busy: 'Running', idle: 'Stopped', waiting: 'Waiting for you', unknown: 'No signal',
          paused: 'Paused', waitingReset: 'Waiting for limit reset',
          auto: 'Autonomous mode', manual: 'Manual', floor: 'Floor', live: 'Live',
          pinned: 'pinned by the project', tokens: 'tokens', estimated: 'estimated',
          play: 'Continue', pause: 'Pause', resume: 'Resume', openLive: 'View live',
          link: 'Link', linked: 'Linked to ', unlink: 'Unlink',
          floorStrict: 'strict — only the safe passes alone',
          floorBalanced: 'balanced — medium risks pass',
          floorOpen: 'open — almost everything passes alone',
          lowerFloorQ: 'Lower this session floor to ', confirmQ: '?',
          autoOnQ: 'Turn autonomous mode on for this session?',
          playTitle: 'Next prompt', playHint: 'Sent as if you had typed it in this session terminal.',
          send: 'Send', cancel: 'Cancel', sent: 'Sent. The session starts in a moment.',
          notIdle: 'The session is working again; wait for it to stop.',
          fail: 'Did not work now (', failEnd: '). Try again.',
          liveTitle: 'Live', liveOff: 'Live is off for this session.', liveEmpty: 'Nothing in the terminal yet.',
          liveUpdated: 'updated ', back: 'Back',
          newTitle: 'New session', newFolder: 'Project folder', newPrompt: 'What should the session do?',
          newOpen: 'Open terminal', newOpened: 'Terminal opened. The session shows up here in a moment.',
          newDisabled: 'Opening a session from the phone is off. Turn it on at the computer with:',
          newEnableCmd: 'gatekeeper-suite configure --set GATEKEEPER_MINIAPP_SPAWN=true',
          newNoDirs: 'No known folder yet. Open a session on the computer once, or pin folders in GATEKEEPER_MINIAPP_SPAWN_DIRS.',
          newManual: 'The new session starts in manual mode.',
          linkTitle: 'Link session', linkLocal: 'Another session on this computer',
          linkCreate: 'Link', linkCreated: 'Sessions linked.',
          linkInvite: 'Invite for another computer', linkInviteMake: 'Create invite',
          linkInviteHint: 'Open the Mini App of the other computer and paste it under "Accept invite". Valid for 10 minutes, once.',
          linkCopy: 'Copy', linkCopied: 'Copied.',
          linkAccept: 'Accept invite', linkAcceptPlaceholder: 'Paste the invite code',
          linkAccepted: 'Link with the other computer created.',
          linkNone: 'No other session open on this computer.',
          linkHow: 'Both sessions get the link_send tool to exchange messages.',
          unlinkQ: 'Unlink this session?', unlinked: 'Link closed.' }
  };
  var code = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || 'en';
  var L = T[String(code).toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en'];
  var LOCALE = L === T.pt ? 'pt-BR' : 'en-US';

  function shortCwd(cwd) {
    var partes = String(cwd || '').split(/[\\/]/).filter(Boolean);
    return partes.slice(-2).join('/') || '';
  }
  function sessionTitle(s) {
    var pasta = String(s.cwd || '').split(/[\\/]/).filter(Boolean).pop();
    return pasta || s.name || String(s.sessionId || '').slice(0, 8);
  }
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
  function formatWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
  }
  function httpStatus(erro) { return String((erro && erro.message) || '').replace('http_', ''); }
  function haptic(kind) {
    try { tg.HapticFeedback.notificationOccurred(kind); } catch (e) { /* opcional */ }
  }
  function confirmar(texto) {
    return new Promise(function (res) {
      if (tg && tg.showConfirm) tg.showConfirm(texto, res); else res(window.confirm(texto));
    });
  }

  // Bottom sheet: painel que sobe do rodapé. `montar(corpo, fechar)` preenche o conteúdo.
  function openSheet(h, titulo, montar) {
    var fundo = h.el('div', 'sheet-backdrop');
    var painel = h.el('div', 'sheet');
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-modal', 'true');
    painel.appendChild(h.el('div', 'sheet-grip'));
    painel.appendChild(h.el('h2', 'sheet-title', titulo));
    var corpo = h.el('div', 'sheet-body');
    painel.appendChild(corpo);
    function fechar() {
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
      window.__gkSheetOpen = false;
    }
    fundo.onclick = function (ev) { if (ev.target === fundo) fechar(); };
    fundo.appendChild(painel);
    document.body.appendChild(fundo);
    window.__gkSheetOpen = true;
    montar(corpo, fechar);
    return fechar;
  }
  window.GK_SHEET = openSheet;

  function usageCard(h, titulo, janela) {
    var card = h.el('div', 'card usage-card');
    var topo = h.el('div', 'usage-head');
    topo.appendChild(h.el('span', 'usage-title', titulo));
    var pct = janela && janela.utilization != null
      ? Math.max(0, Math.min(100, Number(janela.utilization) || 0)) : null;
    topo.appendChild(h.el('span', 'usage-pct', pct == null ? '—' : pct.toFixed(0) + '%'));
    card.appendChild(topo);
    if (pct == null) { card.appendChild(h.el('p', 'muted small', L.noUsage)); return card; }
    var trilha = h.el('div', 'usage-bar');
    var cheio = h.el('div', 'usage-bar-fill');
    cheio.style.width = pct + '%';
    cheio.style.background = pct >= 90 ? 'var(--danger)' : (pct >= 70 ? 'var(--warning)' : 'var(--success)');
    trilha.appendChild(cheio);
    card.appendChild(trilha);
    if (janela.resetsAt) card.appendChild(h.el('p', 'muted small', L.resetsAt + formatWhen(janela.resetsAt)));
    return card;
  }

  var ACTIVITY = { busy: 'busy', idle: 'idle', waiting: 'waiting' };

  function activityChip(h, s) {
    var tipo = s.status === 'waiting_reset' ? 'reset' : (ACTIVITY[s.activity] || 'unknown');
    var texto = tipo === 'reset' ? L.waitingReset : (L[tipo] || L.unknown);
    var chip = h.el('span', 'chip-activity chip-activity-' + tipo);
    chip.appendChild(h.el('span', 'dot'));
    chip.appendChild(document.createTextNode(texto));
    return chip;
  }

  function switchRow(h, rotulo, detalhe, marcado, travado, aoMudar) {
    var linha = h.el('label', 'control-row');
    var textos = h.el('span', 'control-text');
    textos.appendChild(h.el('span', 'control-label', rotulo));
    if (detalhe) textos.appendChild(h.el('span', 'control-detail', detalhe));
    linha.appendChild(textos);
    var sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.className = 'switch';
    sw.checked = !!marcado;
    sw.disabled = !!travado;
    sw.onchange = function () { aoMudar(sw.checked, sw); };
    linha.appendChild(sw);
    return linha;
  }

  function floorSelect(h, atual, travado, aoMudar) {
    var linha = h.el('label', 'control-row');
    var textos = h.el('span', 'control-text');
    textos.appendChild(h.el('span', 'control-label', L.floor));
    if (travado) textos.appendChild(h.el('span', 'control-detail', L.pinned));
    linha.appendChild(textos);
    var sel = document.createElement('select');
    sel.className = 'row-control compact-select';
    [['strict', L.floorStrict], ['balanced', L.floorBalanced], ['open', L.floorOpen]].forEach(function (par) {
      var op = document.createElement('option');
      op.value = par[0];
      op.textContent = par[1];
      sel.appendChild(op);
    });
    sel.value = atual || 'strict';
    sel.disabled = !!travado;
    sel.onchange = function () { aoMudar(sel.value, sel); };
    linha.appendChild(sel);
    return linha;
  }

  var ORDEM_PISO = { strict: 0, balanced: 1, open: 2 };

  function postAuto(ctx, h, s, corpo, rollback) {
    return h.api(ctx, 'POST', 'sessions-auto/' + encodeURIComponent(s.sessionId), corpo)
      .then(function (r) { s.auto = r.auto; haptic('success'); })
      .catch(function (erro) { rollback(); h.showToast(L.fail + httpStatus(erro) + L.failEnd, 'danger'); });
  }

  function autoSwitch(ctx, h, s, auto) {
    return switchRow(h, L.auto, auto.enabled ? null : L.manual, auto.enabled,
      auto.enabledPinned, function (ligado, sw) {
        var aplicar = function () {
          postAuto(ctx, h, s, { enabled: ligado }, function () { sw.checked = !ligado; });
        };
        if (!ligado) { aplicar(); return; }
        confirmar(L.autoOnQ).then(function (ok) { if (ok) aplicar(); else sw.checked = false; });
      });
  }

  function floorControl(ctx, h, s, auto) {
    return floorSelect(h, auto.floor, auto.floorPinned, function (piso, sel) {
      var anterior = auto.floor;
      var aplicar = function () {
        postAuto(ctx, h, s, { floor: piso }, function () { sel.value = anterior; })
          .then(function () { auto.floor = piso; });
      };
      // Baixar o piso libera mais coisa sem perguntar: confirmação explícita.
      if (ORDEM_PISO[piso] > ORDEM_PISO[anterior]) {
        confirmar(L.lowerFloorQ + piso + L.confirmQ).then(function (ok) {
          if (ok) aplicar(); else sel.value = anterior;
        });
      } else { aplicar(); }
    });
  }

  function liveSwitch(ctx, h, s) {
    return switchRow(h, L.live, null, s.live, false, function (ligado, sw) {
      h.api(ctx, 'POST', 'live-toggle/' + encodeURIComponent(s.sessionId), { enabled: ligado })
        .then(function () { s.live = ligado; haptic('success'); })
        .catch(function (erro) {
          sw.checked = !ligado;
          h.showToast(L.fail + httpStatus(erro) + L.failEnd, 'danger');
        });
    });
  }

  function autoControls(ctx, h, s) {
    var caixa = h.el('div', 'session-controls');
    var auto = s.auto || { enabled: false, floor: 'strict' };
    caixa.appendChild(autoSwitch(ctx, h, s, auto));
    caixa.appendChild(floorControl(ctx, h, s, auto));
    caixa.appendChild(liveSwitch(ctx, h, s));
    return caixa;
  }

  function sessionHead(h, s) {
    var topo = h.el('div', 'session-card-head');
    var titulos = h.el('div', 'session-titles');
    titulos.appendChild(h.el('span', 'session-title', sessionTitle(s)));
    titulos.appendChild(h.el('span', 'session-sub',
      shortCwd(s.cwd) + ' · ' + String(s.sessionId).slice(0, 8)));
    topo.appendChild(titulos);
    topo.appendChild(activityChip(h, s));
    return topo;
  }

  function sessionMeta(h, s) {
    var meta = h.el('div', 'session-meta');
    if (s.elapsedS != null) meta.appendChild(h.el('span', null, formatElapsed(s.elapsedS)));
    meta.appendChild(h.el('span', null, formatTokens(s.tokens) + ' ' + L.tokens));
    if (s.estimatedPercent != null) {
      meta.appendChild(h.el('span', null, s.estimatedPercent.toFixed(1) + '% · ' + L.estimated));
    }
    if (s.status === 'paused') meta.appendChild(h.el('span', 'meta-warn', L.paused));
    return meta;
  }

  function actionButton(h, iconName, texto, classe, aoTocar) {
    var b = h.iconLabel('button', iconName, texto);
    b.type = 'button';
    b.className = 'btn-chip ' + (classe || '');
    b.onclick = aoTocar;
    return b;
  }

  function pauseToggle(ctx, h, s, refresh) {
    var pausada = s.status === 'paused';
    var b = actionButton(h, pausada ? 'play' : 'pause', pausada ? L.resume : L.pause, '', function () {
      b.disabled = true;
      var rota = (pausada ? 'sessions-resume/' : 'sessions-pause/') + encodeURIComponent(s.sessionId);
      h.api(ctx, 'POST', rota, {}).then(refresh).catch(function (erro) {
        b.disabled = false;
        h.showToast(L.fail + httpStatus(erro) + L.failEnd, 'danger');
      });
    });
    return b;
  }

  function sessionActions(ctx, h, s, refresh) {
    var barra = h.el('div', 'session-actions');
    if (s.activity === 'idle' && s.status !== 'waiting_reset') {
      barra.appendChild(actionButton(h, 'play', L.play, 'btn-chip-primary',
        function () { openPlaySheet(ctx, h, s); }));
    }
    if (s.status !== 'waiting_reset') barra.appendChild(pauseToggle(ctx, h, s, refresh));
    if (s.live) {
      barra.appendChild(actionButton(h, 'eye', L.openLive, '', function () {
        h.go('live', { session: s.sessionId });
      }));
    }
    barra.appendChild(actionButton(h, 'link', L.link, '',
      function () { openLinkSheet(ctx, h, s, refresh); }));
    return barra;
  }

  function linkRow(ctx, h, s, link, refresh) {
    var outro = link.kind === 'local'
      ? String(link.a === s.sessionId ? link.b : link.a).slice(0, 8)
      : (link.peer_name || String(link.peer_sid || '').slice(0, 8));
    var linha = h.el('div', 'link-row');
    linha.appendChild(h.iconLabel('span', 'link', L.linked + outro));
    var sair = h.el('button', 'btn-text', L.unlink);
    sair.type = 'button';
    sair.onclick = function () {
      confirmar(L.unlinkQ).then(function (ok) {
        if (!ok) return;
        h.api(ctx, 'POST', 'links-close/' + encodeURIComponent(link.id), {})
          .then(function () { h.showToast(L.unlinked, 'success'); refresh(); })
          .catch(function (erro) { h.showToast(L.fail + httpStatus(erro) + L.failEnd, 'danger'); });
      });
    };
    linha.appendChild(sair);
    return linha;
  }

  function sessionCard(ctx, h, s, refresh) {
    var card = h.el('div', 'card session-card');
    card.appendChild(sessionHead(h, s));
    if (s.goal) card.appendChild(h.el('p', 'session-goal', s.goal));
    if (s.currentPhase) card.appendChild(h.el('p', 'session-phase', s.currentPhase));
    card.appendChild(sessionMeta(h, s));
    card.appendChild(autoControls(ctx, h, s));
    (s.links || []).forEach(function (l) { card.appendChild(linkRow(ctx, h, s, l, refresh)); });
    card.appendChild(sessionActions(ctx, h, s, refresh));
    return card;
  }

  function emptySessions(h) {
    var vazio = h.el('div', 'empty-state');
    vazio.appendChild(h.el('p', 'empty-title', L.noSessions));
    vazio.appendChild(h.el('p', 'muted', L.noSessionsHint));
    return vazio;
  }

  // Home (Rodada 10): só as sessões abertas AGORA, atualizando a cada 5s. Não redesenha com um
  // sheet aberto ou um campo em foco, para não roubar o que o dono está fazendo.
  S.home = function (ctx, root, h) {
    var limpar = h.skeleton(root);
    var lista = h.el('div', 'home-list');
    function desenhar(resp) {
      h.clear(lista);
      var usage = resp.usage || {};
      var janelas = h.el('div', 'usage-grid');
      janelas.appendChild(usageCard(h, L.usage5h, usage.fiveHour));
      janelas.appendChild(usageCard(h, L.usageWeek, usage.sevenDay));
      lista.appendChild(janelas);
      var sessoes = resp.sessions || [];
      if (!sessoes.length) { lista.appendChild(emptySessions(h)); return; }
      sessoes.forEach(function (s) { lista.appendChild(sessionCard(ctx, h, s, carregar)); });
    }
    function ocupado() {
      var foco = document.activeElement;
      return window.__gkSheetOpen || (foco && /^(SELECT|TEXTAREA|INPUT)$/.test(foco.tagName));
    }
    function carregar() {
      return h.api(ctx, 'GET', 'dashboard').then(function (resp) {
        if (resp && resp.ok === true && !ocupado()) desenhar(resp);
      });
    }
    h.api(ctx, 'GET', 'dashboard').then(function (resp) {
      limpar();
      if (!resp || resp.ok !== true) { h.fallback(undefined, function () { h.go('home'); }); return; }
      root.appendChild(lista);
      desenhar(resp);
      h.every(5000, function () { carregar().catch(function () { /* próximo ciclo tenta */ }); });
    }).catch(function () { limpar(); h.fallback(undefined, function () { h.go('home'); }); });
  };

  function liveRefresh(ctx, h, sid, partes) {
    return h.api(ctx, 'GET', 'live/' + encodeURIComponent(sid)).then(function (r) {
      partes.titulo.textContent = L.liveTitle + ' · ' + sessionTitle(r);
      partes.sub.textContent = shortCwd(r.cwd) + ' · ' + (L[r.status] || L.unknown);
      var tela = partes.tela;
      var colado = tela.scrollHeight - tela.scrollTop - tela.clientHeight < 40;
      tela.textContent = r.text || L.liveEmpty;
      if (colado) tela.scrollTop = tela.scrollHeight;
      partes.rodape.textContent = L.liveUpdated + new Date().toLocaleTimeString(LOCALE);
    });
  }

  // Live de UMA sessão (Rodada 10): aberto só pelo card de uma sessão com live ligado.
  S.live = function (ctx, root, h) {
    var sid = ctx.session || '';
    root.appendChild(h.backLink());
    var partes = { titulo: h.el('h1', 'live-title', L.liveTitle), sub: h.el('p', 'session-sub', ''),
                   tela: h.el('pre', 'live-terminal', ''), rodape: h.el('p', 'muted small', '') };
    root.appendChild(partes.titulo);
    root.appendChild(partes.sub);
    root.appendChild(partes.tela);
    root.appendChild(partes.rodape);
    liveRefresh(ctx, h, sid, partes).then(function () {
      h.every(3000, function () { liveRefresh(ctx, h, sid, partes).catch(function () {}); });
    }).catch(function (erro) {
      var st = httpStatus(erro);
      partes.tela.textContent = st === '409' ? L.liveOff : (L.fail + st + L.failEnd);
    });
  };

  function sheetButtons(h, rotuloOk, aoOk, fechar) {
    var barra = h.el('div', 'sheet-actions');
    var cancelar = h.el('button', 'btn-secondary', L.cancel);
    cancelar.type = 'button';
    cancelar.onclick = fechar;
    var ok = h.el('button', 'btn-primary', rotuloOk);
    ok.type = 'button';
    ok.onclick = function () { aoOk(ok); };
    barra.appendChild(cancelar);
    barra.appendChild(ok);
    return barra;
  }

  function failToast(h, erro, mensagem409) {
    var st = httpStatus(erro);
    h.showToast(st === '409' && mensagem409 ? mensagem409 : (L.fail + st + L.failEnd), 'danger');
  }

  // Play: o texto vai cru para o servidor, que limpa controles e limita o tamanho; quem entrega
  // e o mod dentro do Claude Code, e nada aqui vira HTML.
  function openPlaySheet(ctx, h, s) {
    openSheet(h, L.playTitle + ' · ' + sessionTitle(s), function (corpo, fechar) {
      corpo.appendChild(h.el('p', 'muted small', L.playHint));
      var texto = document.createElement('textarea');
      texto.value = 'continue';
      texto.maxLength = 4000;
      texto.rows = 3;
      corpo.appendChild(texto);
      corpo.appendChild(sheetButtons(h, L.send, function (botao) {
        botao.disabled = true;
        var rota = 'sessions-prompt/' + encodeURIComponent(s.sessionId);
        h.api(ctx, 'POST', rota, { text: texto.value })
          .then(function () { haptic('success'); fechar(); h.showToast(L.sent, 'success'); })
          .catch(function (erro) { botao.disabled = false; failToast(h, erro, L.notIdle); });
      }, fechar));
    });
  }

  function newSessionDisabled(h, corpo) {
    corpo.appendChild(h.el('p', null, L.newDisabled));
    corpo.appendChild(h.el('pre', 'cmd', L.newEnableCmd));
  }

  function folderSelect(h, dirs) {
    var pasta = document.createElement('select');
    pasta.className = 'row-control field';
    dirs.forEach(function (d) {
      var op = document.createElement('option');
      op.value = d;
      op.textContent = d;
      pasta.appendChild(op);
    });
    return pasta;
  }

  function newSessionForm(ctx, h, corpo, fechar, dirs) {
    var pasta = folderSelect(h, dirs);
    corpo.appendChild(h.el('label', 'field-label', L.newFolder));
    corpo.appendChild(pasta);
    corpo.appendChild(h.el('label', 'field-label', L.newPrompt));
    var pedido = document.createElement('textarea');
    pedido.maxLength = 4000;
    pedido.rows = 4;
    corpo.appendChild(pedido);
    corpo.appendChild(h.el('p', 'muted small', L.newManual));
    corpo.appendChild(sheetButtons(h, L.newOpen, function (botao) {
      botao.disabled = true;
      h.api(ctx, 'POST', 'sessions-new', { cwd: pasta.value, prompt: pedido.value })
        .then(function () { haptic('success'); fechar(); h.showToast(L.newOpened, 'success'); })
        .catch(function (erro) { botao.disabled = false; failToast(h, erro); });
    }, fechar));
  }

  // Botão "+" central da barra (app.js chama isto). A lista de pastas vem do servidor: só as
  // permitidas, e a própria função pode estar desligada.
  window.GK_NEW_SESSION = function (ctx, h) {
    openSheet(h, L.newTitle, function (corpo, fechar) {
      var carregando = h.el('p', 'muted', '…');
      corpo.appendChild(carregando);
      h.api(ctx, 'GET', 'sessions-new-dirs').then(function (r) {
        h.clear(corpo);
        if (!r.enabled) { newSessionDisabled(h, corpo); return; }
        if (!(r.dirs || []).length) { corpo.appendChild(h.el('p', 'muted', L.newNoDirs)); return; }
        newSessionForm(ctx, h, corpo, fechar, r.dirs);
      }).catch(function (erro) { h.clear(corpo); corpo.appendChild(h.el('p', 'err', L.fail + httpStatus(erro) + L.failEnd)); });
    });
  };

  function linkLocalSection(ctx, h, s, corpo, outras, concluir) {
    corpo.appendChild(h.el('h3', 'sheet-section', L.linkLocal));
    if (!outras.length) { corpo.appendChild(h.el('p', 'muted small', L.linkNone)); return; }
    var escolha = document.createElement('select');
    escolha.className = 'row-control field';
    outras.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.sessionId;
      op.textContent = sessionTitle(o) + ' · ' + String(o.sessionId).slice(0, 8);
      escolha.appendChild(op);
    });
    corpo.appendChild(escolha);
    var criar = h.el('button', 'btn-primary', L.linkCreate);
    criar.type = 'button';
    criar.onclick = function () {
      criar.disabled = true;
      h.api(ctx, 'POST', 'links', { a: s.sessionId, b: escolha.value })
        .then(function () { concluir(L.linkCreated); })
        .catch(function (erro) { criar.disabled = false; failToast(h, erro); });
    };
    corpo.appendChild(criar);
  }

  function linkInviteSection(ctx, h, s, corpo) {
    corpo.appendChild(h.el('h3', 'sheet-section', L.linkInvite));
    var gerar = h.el('button', 'btn-secondary', L.linkInviteMake);
    gerar.type = 'button';
    var saida = h.el('div', 'invite-out');
    gerar.onclick = function () {
      gerar.disabled = true;
      h.api(ctx, 'POST', 'links-invite', { sid: s.sessionId }).then(function (r) {
        h.clear(saida);
        saida.appendChild(h.el('pre', 'cmd', r.code));
        saida.appendChild(h.el('p', 'muted small', L.linkInviteHint));
        var copiar = h.el('button', 'btn-secondary', L.linkCopy);
        copiar.type = 'button';
        copiar.onclick = function () {
          navigator.clipboard.writeText(r.code).then(function () { h.showToast(L.linkCopied, 'success'); });
        };
        saida.appendChild(copiar);
      }).catch(function (erro) { gerar.disabled = false; failToast(h, erro); });
    };
    corpo.appendChild(gerar);
    corpo.appendChild(saida);
  }

  function linkAcceptSection(ctx, h, s, corpo, concluir) {
    corpo.appendChild(h.el('h3', 'sheet-section', L.linkAccept));
    var codigo = document.createElement('textarea');
    codigo.rows = 2;
    codigo.maxLength = 2000;
    codigo.placeholder = L.linkAcceptPlaceholder;
    corpo.appendChild(codigo);
    var aceitar = h.el('button', 'btn-secondary', L.linkAccept);
    aceitar.type = 'button';
    aceitar.onclick = function () {
      aceitar.disabled = true;
      h.api(ctx, 'POST', 'links-accept', { sid: s.sessionId, code: codigo.value.trim() })
        .then(function () { concluir(L.linkAccepted); })
        .catch(function (erro) { aceitar.disabled = false; failToast(h, erro); });
    };
    corpo.appendChild(aceitar);
  }

  function openLinkSheet(ctx, h, s, refresh) {
    openSheet(h, L.linkTitle + ' · ' + sessionTitle(s), function (corpo, fechar) {
      corpo.appendChild(h.el('p', 'muted small', L.linkHow));
      var concluir = function (msg) { haptic('success'); fechar(); h.showToast(msg, 'success'); refresh(); };
      h.api(ctx, 'GET', 'dashboard').then(function (r) {
        var outras = (r.sessions || []).filter(function (o) { return o.sessionId !== s.sessionId; });
        linkLocalSection(ctx, h, s, corpo, outras, concluir);
        linkInviteSection(ctx, h, s, corpo);
        linkAcceptSection(ctx, h, s, corpo, concluir);
      }).catch(function (erro) { failToast(h, erro); });
    });
  }
})();
