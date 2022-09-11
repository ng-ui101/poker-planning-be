import {WebSocketServer as Server} from 'ws';
import express from 'express';
import cors from 'cors';
import {v4 as uuid} from 'uuid';

const roomClientsDict = {};
const roomEstimateEvents = [];
const activeRooms = [];

const app = express();

app.use(cors())

app.post('/api/create-room', function (request, response) {
    const roomId = uuid();

    roomClientsDict[roomId] = {};
    roomEstimateEvents[roomId] = [];
    activeRooms.push(roomId);

    response.send({roomId})
});

app.get('/api/get-room', function (request, response) {
    const roomIsActive = !!activeRooms.find((r) => r === request.query.roomId);
    response.send({roomIsActive});
})

app.listen(3000);


const wss = new Server({port: 8000});

wss.on('connection', (ws, req) => {
    const roomId = req.url.slice(1)
    console.log('connection to room:', roomId)

    const clientId = uuid();

    const clients = roomClientsDict[roomId];

    clients[clientId] = ws;

    console.log(`New client ${clientId}`);

    ws.on('message', (rawMessage) => {
        let {type, name, estimate} = JSON.parse(rawMessage);

        if (type === 'set-estimate') {
            let index = roomEstimateEvents[roomId].findIndex((ev) => ev.clientId === clientId);
            if (index >= 0) {
                roomEstimateEvents[roomId].splice(index, 1, {clientId, name, estimate})
            } else {
                roomEstimateEvents[roomId].push({clientId, name, estimate});
            }

            for (const id in clients) {
                clients[id].send(JSON.stringify({
                    type: 'estimates',
                    estimates: roomEstimateEvents[roomId]
                }))
            }
        }

        if (type === 'accept') {
            const amount = roomEstimateEvents[roomId].length;
            const sum = roomEstimateEvents[roomId].reduce((p, c) => p.estimate + c.estimate);
            const finalEstimate = sum / amount;

            for (const id in clients) {
                clients[id].send(JSON.stringify({
                    type: 'final-estimate',
                    finalEstimate,
                    estimates: roomEstimateEvents[roomId]
                }))
            }
            roomEstimateEvents[roomId] = []
        }

        if (type === 'reset') {
            roomEstimateEvents[roomId] = []

            for (const id in clients) {
                clients[id].send(JSON.stringify({
                    type: 'reset',
                    estimates: roomEstimateEvents[roomId]
                }))
            }
        }

        if (type === 'set-user-name') {
            ws.send(JSON.stringify({
                type: 'estimates',
                estimates: roomEstimateEvents[roomId]
            }));
        }

        if (type === 'user-leave') {
            roomEstimateEvents[roomId] = roomEstimateEvents[roomId].filter((r) => r.clientId !== clientId);

            for (const id in clients) {
                clients[id].send(JSON.stringify({
                    type: 'user-leave',
                    estimates: roomEstimateEvents[roomId]
                }))
            }
        }
    })

    ws.on('close', () => {
        delete clients[clientId];
        console.log(`Client is closed ${clientId}`)

        if (Object.keys(clients).length === 0) {
            delete roomClientsDict[roomId];
            delete roomEstimateEvents[roomId];
            const index = activeRooms.findIndex((r) => r === roomId);
            activeRooms.splice(index, 1);
        }
    })
})

process.on('SIGINT', () => {
    wss.close();
})