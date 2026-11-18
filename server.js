// Throw Food & Catch Animals — multiplayer relay server.
// Rooms of 6 players. The server assigns plots, relays positions/throws/catches
// and keeps the shared Server Luck timers. No game logic runs here.
import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = process.env.PORT || 8080;
const ROOM_SIZE = 6;
const LUCK_TIME = 600 * 1000; // 10 min per Server Luck boost
const MAX_LUCK = 5;
const rooms = new Map(); // code -> { id, priv, players: Map(id -> client), luck: [expiry] }
let nextId = 1;
const code = () => { let c; do c = Math.random().toString(36).slice(2, 8); while (rooms.has(c)); return c; };
const newRoom = (priv) => { const r = { id: code(), priv, players: new Map(), luck: [] }; rooms.set(r.id, r); return r; };

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((s, r) => s + r.players.size, 0) })); return; }
  res.writeHead(200); res.end('Throw Food server');
});
const wss = new WebSocketServer({ server, maxPayload: 4096 });

// join = a friend's room code (invite / CrazyGames join), priv = start a new private room (instant multiplayer)
function pickRoom(join, priv) {
  if (join) { const r = rooms.get(join); if (r && r.players.size < ROOM_SIZE) return { r }; }
  if (priv) return { r: newRoom(true) };
  for (const r of rooms.values()) if (!r.priv && r.players.size < ROOM_SIZE) return { r, full: !!join };
  return { r: newRoom(false), full: !!join };
}
// middle pens first: they sit right behind the throw platform, so the walk to your pen is short
const SLOT_ORDER = [2, 3, 1, 4, 0, 5];
function freeSlot(r) { const used = new Set([...r.players.values()].map((c) => c.slot)); for (const i of SLOT_ORDER) if (!used.has(i)) return i; return -1; }
function pub(c) { return { id: c.id, name: c.name, slot: c.slot, ...c.state }; }
function cast(r, msg, except) { const s = JSON.stringify(msg); for (const c of r.players.values()) if (c !== except && c.ws.readyState === 1) c.ws.send(s); }
const clean = (str, n) => String(str || '').replace(/[^\w\- .]/g, '').slice(0, n);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

wss.on('connection', (ws) => {
  const c = { ws, id: nextId++, room: null, slot: -1, name: 'Guest', state: {}, alive: true, budget: 0, budgetT: Date.now() };
  ws.on('pong', () => (c.alive = true));
  ws.on('message', (data) => {
    const now = Date.now(); if (now - c.budgetT > 1000) { c.budgetT = now; c.budget = 0; }
    if (++c.budget > 12) return; // rate limit
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello' && !c.room) {
      c.name = clean(m.name, 20) || 'Guest';
      const { r, full } = pickRoom(clean(m.room, 12), !!m.priv); c.room = r; c.slot = freeSlot(r); r.players.set(c.id, c);
      r.luck = r.luck.filter((t) => t > now);
      ws.send(JSON.stringify({ t: 'welcome', id: c.id, slot: c.slot, room: r.id, priv: r.priv, size: r.players.size, max: ROOM_SIZE, roomFull: !!full, luck: r.luck, players: [...r.players.values()].filter((p) => p !== c).map(pub) }));
      cast(r, { t: 'join', p: pub(c) }, c);
      return;
    }
    const r = c.room; if (!r) return;
    switch (m.t) {
      case 'state':
        c.state = { ips: num(m.ips), money: num(m.money), power: num(m.power), top: Array.isArray(m.top) ? m.top.slice(0, 8).map((a) => ({ id: clean(a.id, 30), m: a.m ? clean(a.m, 12) : null, s: a.s ? clean(a.s, 12) : null })) : [] };
        cast(r, { t: 'state', id: c.id, s: c.state }, c); break;
      case 'pos': cast(r, { t: 'pos', id: c.id, x: num(m.x), z: num(m.z), ry: num(m.ry), a: clean(m.a, 8) }, c); break;
      case 'throw': cast(r, { t: 'throw', id: c.id, d: num(m.d), f: num(m.f) }, c); break;
      case 'catch': cast(r, { t: 'catch', id: c.id, a: clean(m.a, 30), m: m.m ? clean(m.m, 12) : null, s: m.s ? clean(m.s, 12) : null, o: num(m.o, 1) }, c); break;
      case 'luck': {
        r.luck = r.luck.filter((t) => t > now);
        if (r.luck.length < MAX_LUCK) r.luck.push(now + LUCK_TIME); else { r.luck.sort(); r.luck[0] = now + LUCK_TIME; }
        cast(r, { t: 'luck', luck: r.luck, by: c.name }); break;
      }
      case 'emote': cast(r, { t: 'emote', id: c.id, e: clean(m.e, 4) }, c); break;
      default: break;
    }
  });
  ws.on('close', () => {
    const r = c.room; if (!r) return;
    r.players.delete(c.id); cast(r, { t: 'leave', id: c.id });
    if (!r.players.size) rooms.delete(r.id);
  });
});
setInterval(() => { for (const ws of wss.clients) { const c = [...rooms.values()].flatMap((r) => [...r.players.values()]).find((x) => x.ws === ws); if (c && !c.alive) { ws.terminate(); continue; } if (c) c.alive = false; try { ws.ping(); } catch (e) { /* */ } } }, 25000);
server.listen(PORT, () => console.log('Throw Food server on :' + PORT));
