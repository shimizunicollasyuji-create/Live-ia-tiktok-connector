{`import http from 'node:http';
import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent
} from 'tiktok-live-connector';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;
const TASKADE_WEBHOOK_URL = process.env.TASKADE_WEBHOOK_URL;

let connection = null;
let connected = false;
let lastError = null;
let reconnecting = false;

// ==========================
// Enviar para o Taskade
// ==========================
async function enviarParaTaskade(evento) {
  if (!TASKADE_WEBHOOK_URL) return;

  try {
    const resposta = await fetch(TASKADE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(evento)
    });

    console.log(\`Taskade respondeu: \${resposta.status}\`);
  } catch (erro) {
    console.error('Erro Taskade:', erro.message);
  }
}

// ==========================
// Padronizar evento
// ==========================
function criarEvento(tipo, dados = {}) {
  const usuario = dados?.user || {};

  return {
    origem: 'tiktok',
    tipo,
    usuario: usuario.uniqueId || null,
    nome: usuario.nickname || null,
    comentario: dados.comment || null,
    giftId: dados.giftId || null,
    giftName: dados.giftName || null,
    giftCount: dados.repeatCount || null,
    likeCount: dados.likeCount || null,
    viewerCount: dados.viewerCount || null,
    timestamp: new Date().toISOString()
  };
}

// ==========================
// Reconexão automática
// ==========================
function reconectar() {
  if (reconnecting) return;

  reconnecting = true;

  console.log('Reconectando em 5 segundos...');

  setTimeout(async () => {
    reconnecting = false;
    await conectarTikTok();
  }, 5000);
}

// ==========================
// Conectar TikTok
// ==========================
async function conectarTikTok() {
  if (!TIKTOK_USERNAME) {
    console.error('TIKTOK_USERNAME não configurado.');
    return;
  }

  console.log(\`Conectando @\${TIKTOK_USERNAME}...\`);

  connection = new TikTokLiveConnection(TIKTOK_USERNAME, {
    processInitialData: false,
    disableEulerFallbacks: true,
    enableExtendedGiftInfo: false,
    requestPollingIntervalMs: 3000
  });

  connection.on(ControlEvent.CONNECTED, state => {
    connected = true;
    lastError = null;

    console.log(\`TikTok conectado! Sala \${state.roomId}\`);
  });

  connection.on(ControlEvent.DISCONNECTED, () => {
    connected = false;
    console.log('TikTok desconectado.');
    reconectar();
  });

  connection.on(ControlEvent.ERROR, ({ info, exception }) => {
    connected = false;
    lastError = exception?.message || String(exception);

    console.error('Erro TikTok:', info);
    reconectar();
  });

  // Comentários
  connection.on(WebcastEvent.CHAT, async data => {
    const evento = criarEvento('comentario', data);

    console.log(\`[CHAT] \${evento.nome}: \${evento.comentario}\`);

    await enviarParaTaskade(evento);
  });

  // Presentes
  connection.on(WebcastEvent.GIFT, async data => {
    const evento = criarEvento('presente', data);

    console.log(\`[GIFT] \${evento.nome}\`);

    await enviarParaTaskade(evento);
  });

  // Entrada
  connection.on(WebcastEvent.MEMBER, async data => {
    const evento = criarEvento('entrada', data);

    console.log(\`[ENTROU] \${evento.nome}\`);

    await enviarParaTaskade(evento);
  });

  // Seguiu
  connection.on(WebcastEvent.FOLLOW, async data => {
    const evento = criarEvento('seguir', data);

    console.log(\`[SEGUIU] \${evento.nome}\`);

    await enviarParaTaskade(evento);
  });

  // Compartilhou
  connection.on(WebcastEvent.SHARE, async data => {
    const evento = criarEvento('compartilhou', data);

    console.log(\`[SHARE] \${evento.nome}\`);

    await enviarParaTaskade(evento);
  });

  try {
    await connection.connect();
    console.log('Conexão iniciada.');
  } catch (erro) {
    connected = false;
    lastError = erro?.message || String(erro);

    console.error('Falha ao conectar:', lastError);

    reconectar();
  }
}

// ==========================
// Servidor HTTP
// ==========================
const server = http.createServer((req, res) => {

  if (req.method === 'GET' && req.url === '/health') {
    const body = JSON.stringify({
      status: 'ok',
      service: 'live-ia-tiktok-connector',
      tiktok: connected,
      username: TIKTOK_USERNAME,
      lastError,
      timestamp: new Date().toISOString()
    });

    res.writeHead(200, {
      'Content-Type': 'application/json'
    });

    return res.end(body);
  }

  if (req.method === 'GET' && req.url === '/') {
    const body = JSON.stringify({
      status: 'ok',
      tiktokConnected: connected,
      username: TIKTOK_USERNAME
    });

    res.writeHead(200, {
      'Content-Type': 'application/json'
    });

    return res.end(body);
  }

  res.writeHead(404, {
    'Content-Type': 'application/json'
  });

  res.end(JSON.stringify({
    error: 'Not Found'
  }));
});

// ==========================
// Iniciar servidor
// ==========================
server.listen(PORT, HOST, () => {
  console.log(\`Servidor rodando na porta \${PORT}\`);
  conectarTikTok();
});`}
