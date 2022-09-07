import { WebSocketServer as Server } from 'ws';
import {v4 as uuid} from 'uuid';

const clients = {};
const rooms = {};
const roomData = [];

rooms['room-id'] = clients;

//get room-id

const wss = new Server({port: 8000, path: '/room-id'});

wss.on('connection', (ws) => {
    const id = uuid();
    
    //move up
    const clients = rooms['room-id'];
    clients[id] = ws;

    console.log(`New client ${id}`);
    ws.send(JSON.stringify(roomData));

    //command is {
    // type: reset | accept | setUserName | estimate
    // data: null | null | [name] | [estimate]
    //}
    ws.on('message', (rawMessage) => {
        const {name, isAdmin, command} = JSON.parse(rawMessage);

        roomData.push({name, isAdmin, command: {...command}});
        
        for (const id in clients) {
            clients[id].send(JSON.stringify([{name, roomData}]))
        }
    })

    ws.on('close', () => {
        delete clients[id];
        console.log(`Client is closed ${id}`)
    })
})

process.on('SIGINT', () => {
    wss.close();
})