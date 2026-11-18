# Servidor multijogador — Throw Food & Catch Animals

Servidor pequeno em Node.js (WebSocket) que junta os jogadores em servidores de 6, atribui um terreno a cada um e reencaminha posições, lançamentos, capturas e a Server Luck. Não guarda progresso: o progresso de cada jogador continua no próprio browser e na cloud da CrazyGames.

Sem servidor configurado, o jogo funciona sozinho (modo solo), por isso podes publicar primeiro sem multijogador e ligá-lo depois.

## Testar no teu PC
```
cd server
npm install
npm start                      # fica em ws://localhost:8080
```
Na outra pasta: `npx vite`, e abre duas janelas com `http://localhost:5173/?server=ws://localhost:8080`.

## Pôr online (recomendado: VPS barato)
A página da CrazyGames é HTTPS, por isso o servidor tem de usar **wss://** (com certificado). O caminho mais simples:

1. VPS com Ubuntu (por exemplo Hetzner CX22, cerca de 4 €/mês) e um subdomínio a apontar para o IP, por exemplo `jogo.guimatoswebmanager.com`.
2. No VPS:
   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs caddy
   # copiar a pasta server/ para /opt/throwfood-server
   cd /opt/throwfood-server && npm install --omit=dev
   sudo npm i -g pm2 && pm2 start server.js --name throwfood && pm2 save && pm2 startup
   ```
3. `/etc/caddy/Caddyfile` (o Caddy trata do certificado sozinho):
   ```
   jogo.guimatoswebmanager.com {
       reverse_proxy localhost:8080
   }
   ```
   `sudo systemctl reload caddy`
4. Confirma em `https://jogo.guimatoswebmanager.com/health` (deve mostrar `{"ok":true,...}`).
5. Gera o build do jogo já com o endereço do servidor:
   ```
   VITE_SERVER_URL=wss://jogo.guimatoswebmanager.com npx vite build
   ```
   (no Windows PowerShell: `$env:VITE_SERVER_URL="wss://jogo.guimatoswebmanager.com"; npx vite build`)

## Alternativa sem VPS
Render.com → "New Web Service" → aponta para esta pasta, comando `npm start`. O plano gratuito adormece ao fim de 15 min sem tráfego (a primeira ligação demora ~30 s e o jogo entra em solo nesse caso); o plano pago mais barato não adormece.

## Capacidade
Cada jogador envia no máximo cerca de 3 mensagens/s. Um VPS de 4 € aguenta folgadamente várias centenas de jogadores em simultâneo. O endereço `/health` mostra quantas salas e jogadores estão ligados.
