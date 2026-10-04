'use strict';

// Room logic. Runs only in the host's browser; every player (the host included)
// is { id, name, role, send } where send delivers a message to that player.
function createHostRoom(id) {
  const room = { id, hostId: '', players: [], difficulty: 'easy', phase: 'lobby', secret: '', strokes: [], guesses: [], won: false };
  const NEXT = { mime: 'draw', draw: 'guess' };

  const normalize = (s) =>
    s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function broadcastState() {
    for (const p of room.players) {
      const canSeeSecret = room.phase === 'result' || p.role === 'mute';
      p.send({
        type: 'state',
        you: p.id,
        room: {
          id: room.id,
          hostId: room.hostId,
          difficulty: room.difficulty,
          phase: room.phase,
          players: room.players.map((x) => ({ id: x.id, name: x.name, role: x.role })),
          secret: canSeeSecret ? room.secret : null,
          guesses: room.guesses,
          won: room.won,
        },
      });
    }
  }

  function sendStrokes() {
    for (const p of room.players) p.send({ type: 'strokes', strokes: room.strokes });
  }

  function startRound() {
    const roles = ['mute', 'deaf', 'blind'].sort(() => Math.random() - 0.5);
    room.players.forEach((p, i) => (p.role = roles[i]));
    const list = WORDS[room.difficulty];
    room.secret = list[Math.floor(Math.random() * list.length)];
    room.strokes = [];
    room.guesses = [];
    room.won = false;
    room.phase = 'mime';
    broadcastState();
    sendStrokes();
  }

  function finish(won) {
    room.won = won;
    room.phase = 'result';
    broadcastState();
    sendStrokes();
  }

  return {
    addPlayer(name, send) {
      if (room.players.length >= 3) {
        send({ type: 'error', message: 'Комната заполнена (максимум 3 игрока)' });
        return null;
      }
      if (room.phase !== 'lobby') {
        send({ type: 'error', message: 'Игра в этой комнате уже идёт' });
        return null;
      }
      const player = { id: crypto.randomUUID(), name: name.slice(0, 20) || 'Игрок', role: null, send };
      // Newcomer initiates WebRTC connections to everyone already in the room.
      send({ type: 'peers', ids: room.players.map((p) => p.id) });
      room.players.push(player);
      if (!room.hostId) room.hostId = player.id;
      broadcastState();
      return player;
    },

    removePlayer(player) {
      if (!room.players.includes(player)) return;
      room.players = room.players.filter((p) => p !== player);
      for (const p of room.players) p.send({ type: 'peer-left', id: player.id });
      if (room.phase !== 'lobby') {
        room.phase = 'lobby';
        room.players.forEach((p) => (p.role = null));
      }
      broadcastState();
    },

    handle(me, msg) {
      switch (msg.type) {
        case 'signal': {
          const target = room.players.find((p) => p.id === msg.to);
          if (target) target.send({ type: 'signal', from: me.id, data: msg.data });
          break;
        }
        case 'difficulty':
          if (me.id === room.hostId && room.phase === 'lobby' && msg.value in WORDS) {
            room.difficulty = msg.value;
            broadcastState();
          }
          break;
        case 'start':
          if (me.id === room.hostId && room.players.length === 3 && (room.phase === 'lobby' || room.phase === 'result')) {
            startRound();
          }
          break;
        case 'next': {
          const next = NEXT[room.phase];
          if (!next) break;
          room.phase = next;
          broadcastState();
          // Blind sees their own board only from the guess phase on.
          if (next === 'guess') sendStrokes();
          break;
        }
        case 'draw':
          if (room.phase === 'draw' && me.role === 'blind' && Array.isArray(msg.seg) && msg.seg.length === 4) {
            const seg = msg.seg.map(Number);
            room.strokes.push(seg);
            for (const p of room.players) if (p !== me) p.send({ type: 'seg', seg });
          }
          break;
        case 'guess': {
          if (room.phase !== 'guess' || me.role !== 'blind') break;
          const g = String(msg.text || '').slice(0, 100).trim();
          if (!g) break;
          room.guesses.push(g);
          if (normalize(g) === normalize(room.secret)) finish(true);
          else broadcastState();
          break;
        }
        case 'accept': // the mute knows the answer and can accept a close-enough guess
          if (room.phase === 'guess' && me.role === 'mute') finish(true);
          break;
        case 'giveup':
          if (room.phase === 'guess') finish(false);
          break;
      }
    },
  };
}
