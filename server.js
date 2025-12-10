const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients
let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
        console.log('WebSocket client disconnected');
    });
});

// Broadcast to all WebSocket clients
function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// API endpoints
app.get('/api/devices', async (req, res) => {
    try {
        const ports = await SerialPort.list();
        res.json({ success: true, devices: ports });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/connect', async (req, res) => {
    const { port, baudRate = 9600 } = req.body;
    
    try {
        const serialPort = new SerialPort({
            path: port,
            baudRate: parseInt(baudRate),
            autoOpen: false
        });

        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        serialPort.open((err) => {
            if (err) {
                return res.json({ success: false, error: err.message });
            }
            
            parser.on('data', (data) => {
                console.log('Received:', data);
                broadcast({ type: 'data', data: data });
            });

            res.json({ 
                success: true, 
                message: `Connected to ${port} at ${baudRate} baud` 
            });
        });

    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});