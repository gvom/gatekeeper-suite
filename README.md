# Gatekeeper Suite — Mini App (página estática)

Uma única página para todas as instalações. Publique este diretório (GitHub Pages, Cloudflare
Pages ou Netlify) e grave a URL resultante em cada instalação:

    gatekeeper-suite configure --advanced --set GATEKEEPER_MINIAPP_STATIC_URL=https://<host>/<path>/

Roteamento pelo fragmento: `#screen=<tela>&card=<id opaco>&api=<host https do túnel>`. Nada vai
em query string. `initData` só viaja no header `X-Telegram-Init-Data` para o host `api`.
Sem build step: HTML/CSS/JS vanilla + `telegram-web-app.js` oficial.
