import http from 'node:http';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;
const TASKADE_WEBHOOK_URL = process.env.TASKADE_WEBHOOK_URL;

let connection = null;
let connected = false;

async function enviarParaTaskade(evento) {
    if (!TASKADE_WEBHOOK_URL) {
        console.log('TASKADE_WEBHOOK_URL não configurado.');
        return;
    }

    try {
        const resposta = await fetch(TASKADE_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(evento)
        });

        console.log(
            `Taskade respondeu: ${resposta.status}`
        );
    } catch (erro) {
        console.error(
            'Erro ao enviar evento para o Taskade:',
            erro.message
        );
    }
}

function criarEvento(tipo, dados) {
    return {
        origem: 'tiktok',
        tipo,
        usuario: dados?.user?.uniqueId || null,
        nome: dados?.user?.nickname || null,
        comentario: dados?.comment || null,
        giftId: dados?.giftId || null,
        giftName: dados?.giftName || null,
        giftCount: dados?.repeatCount || null,
        likeCount: dados?.likeCount || null,
        viewerCount: dados?.viewerCount || null,
        timestamp: new Date().toISOString()
    };
}

async function conectarTikTok() {
    if (!TIKTOK_USERNAME) {
        console.log(
            'TIKTOK_USERNAME não configurado.'
        );
        return;
    }

    console.log(
        `Tentando conectar ao TikTok LIVE de @${TIKTOK_USERNAME}...`
    );

    connection = new TikTokLiveConnection(TIKTOK_USERNAME);

    connection.on(
        ControlEvent.CONNECTED,
        state => {
            connected = true;

            console.log(
                `TikTok conectado! Room ID: ${state.roomId}`
            );
        }
    );

    connection.on(
        ControlEvent.DISCONNECTED,
        () => {
            connected = false;
            console.log('TikTok desconectado.');
        }
    );

    connection.on(
        ControlEvent.ERROR,
        ({ info, exception }) => {
            console.error(
                'Erro do TikTok:',
                info,
                exception
            );
        }
    );

    // COMENTÁRIOS
    connection.on(
        WebcastEvent.CHAT,
        async data => {
            const evento = criarEvento(
                'comentario',
                data
            );

            console.log(
                `[COMENTÁRIO] ${evento.nome}: ${evento.comentario}`
            );

            await enviarParaTaskade(evento);
        }
    );

    // PRESENTES
    connection.on(
        WebcastEvent.GIFT,
        async data => {
            const evento = criarEvento(
                'presente',
                data
            );

            console.log(
                `[PRESENTE] ${evento.nome} - Gift ID: ${evento.giftId}`
            );

            await enviarParaTaskade(evento);
        }
    );

    // NOVO ESPECTADOR
    connection.on(
        WebcastEvent.MEMBER,
        async data => {
            const evento = criarEvento(
                'entrada',
                data
            );

            console.log(
                `[ENTRADA] ${evento.nome}`
            );

            await enviarParaTaskade(evento);
        }
    );

    // SEGUIDOR
    connection.on(
        WebcastEvent.FOLLOW,
        async data => {
            const evento = criarEvento(
                'seguir',
                data
            );

            console.log(
                `[SEGUIU] ${evento.nome}`
            );

            await enviarParaTaskade(evento);
        }
    );

    // COMPARTILHAMENTO
    connection.on(
        WebcastEvent.SHARE,
        async data => {
            const evento = criarEvento(
                'compartilhamento',
                data
            );

            console.log(
                `[COMPARTILHOU] ${evento.nome}`
            );

            await enviarParaTaskade(evento);
        }
    );

    try {
        await connection.connect();

        console.log(
            'Conexão com TikTok iniciada.'
        );
    } catch (erro) {
        connected = false;

        console.error(
            'Não foi possível conectar ao TikTok:',
            erro.message
        );
    }
}

const server = http.createServer(
    (request, response) => {

        if (
            request.method === 'GET' &&
            request.url === '/health'
        ) {
            const body = JSON.stringify({
                status: 'ok',
                service: 'live-ia-tiktok-connector',
                tiktok: connected,
                username: TIKTOK_USERNAME || null,
                timestamp: new Date().toISOString()
            });

            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(body)
            });

            return response.end(body);
        }

        if (
            request.method === 'GET' &&
            request.url === '/'
        ) {
            const body = JSON.stringify({
                status: 'ok',
                service: 'live-ia-tiktok-connector'
            });

            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8'
            });

            return response.end(body);
        }

        response.writeHead(404, {
            'Content-Type': 'application/json'
        });

        response.end(
            JSON.stringify({
                error: 'Not Found'
            })
        );
    }
);

server.listen(
    PORT,
    HOST,
    () => {
        console.log(
            `Servidor rodando na porta ${PORT}`
        );

        conectarTikTok();
    }
);
