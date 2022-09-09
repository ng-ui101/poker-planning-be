import { WebSocketServer as Server } from 'ws';
import express from 'express';
import cors from 'cors';
import {v4 as uuid} from 'uuid';

const roomClientsDict = {};
const roomEventsDict = {};
const estimateDataDict = {};
const nameDataDict = {};
const activeRooms = [];

const app = express();

app.use(cors())

app.post('/api/create-room', function (request, response) {
    const roomId = uuid();

    roomClientsDict[roomId] = {};
    roomEventsDict[roomId] = [];
    estimateDataDict[roomId] = {};
    nameDataDict[roomId] = {};
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
    console.log('room is create', roomId)

    const clientId = uuid();
    let clientName = '';
    
    const clients = roomClientsDict[roomId];
    const roomEvents = roomEventsDict[roomId];
    const estimateData = estimateDataDict[roomId];
    const nameData = nameDataDict[roomId];

    clients[clientId] = ws;

    console.log(`New client ${clientId}`);
    ws.send(JSON.stringify(roomEvents));

    //action is {
    // type: reset | accept | setUserName | estimate | leave
    // data: null | null | [name] | [estimate] | null
    //}
    ws.on('message', (rawMessage) => {
        let {name, action} = JSON.parse(rawMessage);

        if (action.type === 'estimate') {
            estimateData[clientId] = action.data;
            
            const amount = Object.keys(estimateData).length;
            if (amount === Object.keys(clients).length) {
                let summ = 0;
                for (const est in estimateData) {
                    summ += estimateData[est];
                }
                const finalEstimate = summ / amount;

                for (const id in clients) {
                    clients[id].send(JSON.stringify({finalEstimate}))
                }
                estimateDataDict[roomId] = {}
            }
        }

        if (action.type === 'accept') {
            const amount = Object.keys(estimateData).length;
            let summ = 0;
            for (const est in estimateData) {
                summ += estimateData[est];
            }
            const finalEstimate = summ / amount;
            for (const id in clients) {
                clients[id].send(JSON.stringify({finalEstimate}))
            }
            estimateDataDict[roomId] = {};
        }

        if (action.type === 'reset') {
            estimateDataDict[roomId] = {}
        }

        if (action.type === 'setUserName') {
            name = action.data;
            clientName = action.data;
            nameData[clientId] = action.data;
            console.log('nameData', nameData)
        }

        roomEvents.push({name, action});
        
        for (const id in clients) {
            clients[id].send(JSON.stringify({name, action}))
        }
    })

    ws.on('close', () => {
        for (const id in clients) {
            clients[id].send(JSON.stringify({name: clientName, action: {type: 'leave'}}));
        }
        
        delete clients[clientId];
        delete estimateData[clientId];
        console.log(`Client is closed ${clientId}`)
        
        if (Object.keys(clients).length === 0) {
            delete roomClientsDict[roomId];
            delete roomEventsDict[roomId];
            delete estimateDataDict[roomId];
            delete nameDataDict[roomId];
            const index = activeRooms.findIndex((r) => r === roomId);
            activeRooms.splice(index, 1);
        }
    })
})

process.on('SIGINT', () => {
    wss.close();
})