import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Database from 'better-sqlite3';
import { Connection, PublicKey } from '@solana/web3.js';
import { onProgramEvent } from './solana.js';

const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('HEpGLgYsE1kP8aoYKyLFc3JVVrofS7T4zEA6fWBJsZps');

const db = new Database('pod.db');

db.exec(`CREATE TABLE IF NOT EXISTS agent_registered (
  agent TEXT,
  capabilities INTEGER,
  metadata_uri TEXT,
  timestamp INTEGER
);
CREATE TABLE IF NOT EXISTS message_sent (
  sender TEXT,
  recipient TEXT,
  message_type TEXT,
  timestamp INTEGER
);`);

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

app.post('/messages', (req, res) => {
  const { sender, recipient, payload } = req.body || {};
  if (!sender || !recipient || !payload) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  for (const ws of clients) {
    ws.send(JSON.stringify({ type: 'message', sender, recipient, payload }));
  }

  return res.json({ ok: true });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const connection = new Connection(RPC_URL, 'confirmed');
onProgramEvent(connection, PROGRAM_ID, (event) => {
  if (event.name === 'AgentRegistered') {
    const stmt = db.prepare('INSERT INTO agent_registered VALUES (?,?,?,?)');
    stmt.run(event.data.agent, event.data.capabilities, event.data.metadata_uri, event.data.timestamp);
  } else if (event.name === 'MessageSent') {
    const stmt = db.prepare('INSERT INTO message_sent VALUES (?,?,?,?)');
    stmt.run(event.data.sender, event.data.recipient, event.data.message_type, event.data.timestamp);
  }

  for (const ws of clients) {
    ws.send(JSON.stringify({ type: 'event', event }));
  }
});
