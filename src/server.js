import http from "node:http";
import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
} from "tiktok-live-connector";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;
const TASKADE_WEBHOOK_URL = process.env.TASKADE_WEBHOOK_URL;

let connection = null;
let connected = false;
let lastError = null;

// =========================
// Enviar para o Taskade
// =========================
async function enviarParaTaskade(evento) {
  if (!TASKADE_WEBHOOK_URL) return;

  try {
    const resposta = await fetch(TASKADE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(evento),
    });

    console.log(`Taskade respondeu: ${resposta.status}`);
  } catch (erro) {
    console.error("Erro Taskade:", erro.message);
  }
}

// =========================
// Criar objeto padrão
// =========================
function criarEvento(tipo, dados = {}) {
  const usuario = dados.user || {};

  return {
    origem: "tiktok",
    tipo,
    usuario: usuario.uniqueId || null,
    nome: usuario.nickname || null,

    // CORRIGIDO
    comentario:
      dados.comment ||
      dados.text ||
      dados.message ||
      null,

    giftId: dados.giftId || null,
    giftName: dados.giftName || null,
    giftCount: dados.repeatCount || null,
    likeCount: dados.likeCount || null,
    viewerCount: dados.viewerCount || null,
    timestamp: new Date().toISOString(),
  };
}

// =========================
// Conectar TikTok
// =========================
async function conectarTikTok() {
  connection = new TikTokLiveConnection(TIKTOK_USERNAME, {
    processInitialData: false,
    enableExtendedGiftInfo: false,
  });

  connection.on(ControlEvent.CONNECTED, (state) => {
    connected = true;
    lastError = null;

    console.log(`TikTok conectado! Room ID: ${state.roomId}`);
  });

  connection.on(ControlEvent.DISCONNECTED, () => {
    connected = false;
    console.log("TikTok desconectado.");
  });

  connection.on(ControlEvent.ERROR, ({ exception }) => {
    connected = false;
    lastError = exception?.message || "Erro";
    console.log(lastError);
  });

  // =========================
  // Comentários (CORRIGIDO)
  // =========================
  connection.on(WebcastEvent.CHAT, async (data) => {
    const evento = criarEvento("comentario", data);

    console.log(
      `[COMENTÁRIO] ${evento.nome}: ${evento.comentario}`
    );

    await enviarParaTaskade(evento);
  });

  // Entradas
  connection.on(WebcastEvent.MEMBER, async (data) => {
    const evento = criarEvento("entrada", data);

    console.log(`[ENTRADA] ${evento.nome}`);

    await enviarParaTaskade(evento);
  });

  // Seguidores
  connection.on(WebcastEvent.FOLLOW, async (data) => {
    const evento = criarEvento("seguir", data);

    console.log(`[SEGUIU] ${evento.nome}`);

    await enviarParaTaskade(evento);
  });

  // Presentes
  connection.on(WebcastEvent.GIFT, async (data) => {
    const evento = criarEvento("presente", data);

    console.log(`[PRESENTE] ${evento.nome}`);

    await enviarParaTaskade(evento);
  });

  // Compartilhamento
  connection.on(WebcastEvent.SHARE, async (data) => {
    const evento = criarEvento("compartilhamento", data);

    console.log(`[COMPARTILHOU] ${evento.nome}`);

    await enviarParaTaskade(evento);
  });

  try {
    console.log(
      `Tentando conectar ao TikTok LIVE de @${TIKTOK_USERNAME}...`
    );

    await connection.connect();

    console.log("Conexão com TikTok iniciada.");
  } catch (erro) {
    lastError = erro.message;
    console.log(lastError);
  }
}

// =========================
// Servidor HTTP
// =========================
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    return res.end(
      JSON.stringify({
        status: "ok",
        tiktok: connected,
        lastError,
      })
    );
  }

  if (req.url === "/") {
    return res.end(
      JSON.stringify({
        status: "online",
        username: TIKTOK_USERNAME,
      })
    );
  }

  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  conectarTikTok();
});
