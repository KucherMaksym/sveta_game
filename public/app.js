'use strict';

const ROLES = {
  mute: { title: 'Немой', icon: '🤐', rule: 'Не можешь говорить. Видишь и слышишь.' },
  deaf: { title: 'Глухой', icon: '🙉', rule: 'Не слышишь. Видишь и говоришь.' },
  blind: { title: 'Слепой', icon: '🙈', rule: 'Не видишь. Слышишь и говоришь.' },
};
const DIFFICULTY = { easy: 'Лёгкая — слово', medium: 'Средняя — словосочетание', hard: 'Сложная — предложение' };

// Who can see / hear whom in each phase: [fromRole, toRole, 'video' | 'audio'].
const LINKS = {
  lobby: '*',
  result: '*',
  mime: [['mute', 'deaf', 'video'], ['deaf', 'mute', 'video'], ['deaf', 'mute', 'audio']],
  draw: [['deaf', 'blind', 'audio']],
  guess: [
    ['blind', 'mute', 'audio'], ['mute', 'deaf', 'video'], ['deaf', 'blind', 'audio'],
    ['deaf', 'mute', 'audio'], ['deaf', 'mute', 'video'],
  ],
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let ws;
let myId = null;
let room = null;
let localStream = null;
let strokes = [];
const peers = new Map(); // id -> { pc, stream, tile, video, audio, chain }

const params = new URLSearchParams(location.search);
const roomParam = params.get('room');
if (roomParam) {
  $('#join-title').textContent = 'Тебя позвали играть';
  $('#join-sub').textContent = `Комната ${roomParam}. Понадобятся камера и микрофон.`;
  $('#join-btn').textContent = 'Войти';
}
$('#name').value = localStorage.getItem('sgn-name') || '';
$('#join-btn').onclick = join;
$('#name').onkeydown = (e) => {
  if (e.key === 'Enter') join();
};

$('#invite-btn').onclick = async () => {
  const url = `${location.origin}/?room=${room.id}`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    navigator.share({ title: 'Слепой, Глухой, Немой', url }).catch(() => {});
    return;
  }
  await navigator.clipboard.writeText(url);
  $('#invite-btn').textContent = 'Ссылка скопирована';
  setTimeout(() => ($('#invite-btn').textContent = 'Скопировать приглашение'), 1500);
};

async function getMedia() {
  for (const c of [{ video: true, audio: true }, { audio: true }, { video: true }]) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch {}
  }
  return new MediaStream();
}

async function join() {
  const name = $('#name').value.trim();
  if (!name) return $('#name').focus();
  localStorage.setItem('sgn-name', name);
  $('#join-btn').disabled = true;
  localStream = await getMedia();
  if (!localStream.getTracks().length) {
    $('#join-error').textContent = 'Нет доступа к камере и микрофону — играть можно, но тебя не увидят и не услышат.';
  }
  addTile('self', 'Ты', localStream, true);

  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: roomParam, name }));
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => {
    if (room) $('#stage').innerHTML = '<div class="waiting"><div class="big">🔌</div><h2>Соединение потеряно</h2><p class="muted">Обнови страницу.</p></div>';
  };
}

const sendMsg = (msg) => ws.send(JSON.stringify(msg));

function onMessage(msg) {
  switch (msg.type) {
    case 'error':
      $('#join-error').textContent = msg.message;
      $('#join-btn').disabled = false;
      break;
    case 'peers':
      for (const id of msg.ids) createPeer(id, true);
      break;
    case 'signal':
      onSignal(msg.from, msg.data);
      break;
    case 'peer-left': {
      const p = peers.get(msg.id);
      if (p) {
        p.pc.close();
        p.tile.remove();
        peers.delete(msg.id);
      }
      break;
    }
    case 'state':
      myId = msg.you;
      room = msg.room;
      history.replaceState(null, '', `?room=${room.id}`);
      render();
      break;
    case 'strokes':
      strokes = msg.strokes;
      redrawCanvas();
      break;
    case 'seg':
      strokes.push(msg.seg);
      drawSeg($('#board'), msg.seg);
      break;
  }
}

// ---------- WebRTC (full mesh, 3 people) ----------

function createPeer(id, initiator) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const stream = new MediaStream();
  const peer = { pc, stream, chain: Promise.resolve() };
  peers.set(id, peer);
  Object.assign(peer, addTile(id, '', stream, false));

  pc.onicecandidate = (e) => e.candidate && sendMsg({ type: 'signal', to: id, data: { candidate: e.candidate } });
  pc.ontrack = (e) => {
    stream.addTrack(e.track);
    peer.video.play().catch(() => {});
    peer.audio.play().catch(() => {});
  };

  if (initiator) {
    // Always negotiate both kinds so the other side can send even if we have no camera/mic.
    for (const kind of ['audio', 'video']) {
      const track = localStream.getTracks().find((t) => t.kind === kind);
      if (track) pc.addTrack(track, localStream);
      else pc.addTransceiver(kind);
    }
    peer.chain = peer.chain.then(async () => {
      await pc.setLocalDescription(await pc.createOffer());
      sendMsg({ type: 'signal', to: id, data: { sdp: pc.localDescription } });
    });
  }
  applyMediaRules();
  return peer;
}

function onSignal(from, data) {
  const peer = peers.get(from) || createPeer(from, false);
  const { pc } = peer;
  peer.chain = peer.chain.then(async () => {
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === 'offer') {
        // Added after the offer so the tracks reuse the offered transceivers.
        for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
        await pc.setLocalDescription(await pc.createAnswer());
        sendMsg({ type: 'signal', to: from, data: { sdp: pc.localDescription } });
      }
    } else if (data.candidate) {
      await pc.addIceCandidate(data.candidate).catch(() => {});
    }
  });
}

function addTile(id, label, stream, self) {
  const tile = document.createElement('div');
  tile.className = 'tile' + (self ? ' self' : '');
  tile.innerHTML = '<video autoplay playsinline muted></video><audio autoplay></audio><label></label>';
  const video = tile.querySelector('video');
  const audio = tile.querySelector('audio');
  video.srcObject = stream;
  if (self) audio.remove();
  else audio.srcObject = stream;
  tile.querySelector('label').textContent = label;
  $('#videos').append(tile);
  return { tile, video, audio };
}

function roleOf(id) {
  return room?.players.find((p) => p.id === id)?.role;
}

function allowed(fromId, toId, kind) {
  const links = LINKS[room?.phase || 'lobby'];
  if (links === '*') return true;
  const from = roleOf(fromId);
  const to = roleOf(toId);
  return links.some(([f, t, k]) => f === from && t === to && k === kind);
}

function applyMediaRules() {
  if (!room) return;
  const me = roleOf(myId);
  const inGame = !['lobby', 'result'].includes(room.phase);
  for (const [id, peer] of peers) {
    const p = room.players.find((x) => x.id === id);
    const label = p ? p.name + (p.role ? ` · ${ROLES[p.role].title}` : '') : '';
    peer.tile.querySelector('label').textContent = label;
    peer.tile.classList.toggle('off', !allowed(id, myId, 'video'));
    peer.audio.muted = !allowed(id, myId, 'audio');
  }
  // The blind don't even see themselves; the mute's mic is physically off.
  $('.tile.self').classList.toggle('off', inGame && me === 'blind');
  for (const t of localStream.getAudioTracks()) t.enabled = !(inGame && me === 'mute');

  const names = (kind, dir) =>
    room.players
      .filter((p) => p.id !== myId && (dir === 'out' ? allowed(myId, p.id, kind) : allowed(p.id, myId, kind)))
      .map((p) => esc(p.name))
      .join(', ') || 'никто';
  $('#media-status').innerHTML = `
    <div>Тебя видят: <b>${names('video', 'out')}</b></div>
    <div>Тебя слышат: <b>${names('audio', 'out')}</b></div>
    <div>Ты видишь: <b>${names('video', 'in')}</b></div>
    <div>Ты слышишь: <b>${names('audio', 'in')}</b></div>`;
}

// ---------- UI ----------

function render() {
  $('#join').hidden = true;
  $('#game').hidden = false;
  $('#room-info').hidden = false;
  $('#room-code').textContent = `Комната ${room.id}`;

  const me = room.players.find((p) => p.id === myId);
  const role = me.role;
  const inGame = !['lobby'].includes(room.phase);

  const banner = $('#role-banner');
  banner.hidden = !role;
  if (role) {
    banner.className = `role-${role}`;
    banner.innerHTML = `<b>${ROLES[role].icon} Ты — ${ROLES[role].title}</b><span>${ROLES[role].rule}</span>`;
  }

  const order = ['mime', 'draw', 'guess', 'result'];
  $('#steps').hidden = !inGame;
  for (const li of $('#steps').children) {
    const i = order.indexOf(li.dataset.phase);
    const cur = order.indexOf(room.phase);
    li.classList.toggle('active', i === cur);
    li.classList.toggle('done', i < cur);
  }

  const stage = $('#stage');
  stage.innerHTML = VIEWS[room.phase](role, me);
  bindStage();
  applyMediaRules();
}

const nameByRole = (r) => esc(room.players.find((p) => p.role === r)?.name || '');
const waiting = (icon, title, text) =>
  `<div class="waiting"><div class="big">${icon}</div><h2>${title}</h2><p class="muted">${text}</p></div>`;

const VIEWS = {
  lobby(role, me) {
    const isHost = me.id === room.hostId;
    const slots = [0, 1, 2].map((i) => {
      const p = room.players[i];
      if (!p) return '<li class="empty">Ждём игрока…</li>';
      return `<li><span>${esc(p.name)}${p.id === myId ? ' (ты)' : ''}</span><span class="tag">${p.id === room.hostId ? 'хост' : ''}</span></li>`;
    });
    const opts = Object.entries(DIFFICULTY)
      .map(([k, v]) => `<option value="${k}" ${k === room.difficulty ? 'selected' : ''}>${v}</option>`)
      .join('');
    return `
      <h2>Лобби</h2>
      <p class="muted">Нужно ровно 3 игрока. Отправь друзьям приглашение кнопкой сверху.</p>
      <ul class="players">${slots.join('')}</ul>
      <label>Сложность
        <select id="difficulty" ${isHost ? '' : 'disabled'}>${opts}</select>
      </label>
      ${isHost
        ? `<button id="start" ${room.players.length === 3 ? '' : 'disabled'}>Начать игру — роли раздадутся случайно</button>`
        : '<p class="muted">Хост начнёт игру, когда все соберутся.</p>'}`;
  },

  mime(role) {
    if (role === 'mute') {
      return `
        <p class="muted">Твоё загаданное:</p>
        <div class="secret">${esc(room.secret)}</div>
        <p class="hint">Покажи это <b>${nameByRole('deaf')}</b> (Глухому) пантомимой. Он тебя видит, а ты его видишь и слышишь.</p>
        <button id="next">Глухой понял — дальше</button>`;
    }
    if (role === 'deaf') {
      return `
        <h2>Смотри на Немого</h2>
        <p class="hint"><b>${nameByRole('mute')}</b> показывает загаданное пантомимой. Можешь говорить догадки вслух — Немой тебя слышит и покажет «да/нет».</p>
        <p class="muted">Запомни, что понял: дальше будешь объяснять это Слепому.</p>
        <button id="next">Я понял — дальше</button>`;
    }
    return waiting('🙈', 'Ждём', 'Немой и Глухой сейчас в своей комнате. Ты их не слышишь и не видишь — скоро твой ход.');
  },

  draw(role) {
    if (role === 'blind') {
      return `
        <h2>Рисуй вслепую</h2>
        <p class="hint">Слушай <b>${nameByRole('deaf')}</b> (Глухого) и рисуй на тёмной доске. Ты не увидишь свой рисунок до следующего хода. Глухой тебя не слышит.</p>
        <canvas id="board" width="800" height="600" class="blindfold"></canvas>
        <button id="next">Готово</button>`;
    }
    if (role === 'deaf') {
      return `
        <h2>Объясняй Слепому, что рисовать</h2>
        <p class="hint">Говори <b>${nameByRole('blind')}</b>, что и где нарисовать, <b>не называя загаданных слов</b>. Ты видишь рисунок вживую, но не слышишь Слепого.</p>
        <canvas id="board" width="800" height="600"></canvas>
        <button id="next">Рисунок готов — дальше</button>`;
    }
    return waiting('🤐', 'Ждём', 'Глухой объясняет Слепому, что нарисовать. Ты пока отдыхаешь.');
  },

  guess(role) {
    const list = room.guesses.length
      ? `<ul class="guesses">${room.guesses
          .map((g) => `<li><span>${esc(g)}</span>${role === 'mute' ? '<button class="ok accept">Засчитать</button>' : ''}</li>`)
          .join('')}</ul>`
      : '<p class="muted">Попыток пока нет.</p>';
    const board = '<canvas id="board" width="800" height="600"></canvas>';
    if (role === 'blind') {
      return `
        <h2>Угадай, что загадано</h2>
        <p class="hint">Вот твой рисунок. Задавай <b>${nameByRole('mute')}</b> (Немому) вопросы «да/нет» вслух. Он кивнёт Глухому, а <b>${nameByRole('deaf')}</b> скажет тебе ответ.</p>
        ${board}
        <div class="row"><input id="guess" placeholder="Твой ответ" autocomplete="off"><button id="send-guess">Ответить</button></div>
        ${list}
        <button class="ghost" id="giveup">Сдаться</button>`;
    }
    if (role === 'mute') {
      return `
        <p class="muted">Загадано:</p>
        <div class="secret">${esc(room.secret)}</div>
        <p class="hint">Слепой задаёт тебе вопросы — <b>кивай или мотай головой</b> Глухому. Если ответ Слепого почти верный (другая форма слова) — засчитай.</p>
        ${list}
        ${board}`;
    }
    return `
      <h2>Ты — переводчик</h2>
      <p class="hint">Слепой задаёт вопросы Немому (ты их не слышишь). Смотри, кивает <b>${nameByRole('mute')}</b> или мотает головой, и говори ответ «да» или «нет» вслух.</p>
      ${list}
      ${board}`;
  },

  result(role, me) {
    const isHost = me.id === room.hostId;
    return `
      <div class="result-title ${room.won ? 'win' : 'lose'}">${room.won ? 'Угадали! 🎉' : 'Не угадали'}</div>
      <p class="muted">Было загадано:</p>
      <div class="secret">${esc(room.secret)}</div>
      ${room.guesses.length ? `<p class="muted">Попытки: ${room.guesses.map(esc).join(' · ')}</p>` : ''}
      <canvas id="board" width="800" height="600"></canvas>
      ${isHost ? '<button id="start">Новый раунд (новые роли)</button>' : '<p class="muted">Хост может начать новый раунд.</p>'}`;
  },
};

function bindStage() {
  const on = (sel, fn) => $(sel) && ($(sel).onclick = fn);
  on('#start', () => sendMsg({ type: 'start' }));
  on('#next', () => sendMsg({ type: 'next' }));
  on('#giveup', () => sendMsg({ type: 'giveup' }));
  on('#send-guess', sendGuess);
  if ($('#guess')) $('#guess').onkeydown = (e) => {
    if (e.key === 'Enter') sendGuess();
  };
  if ($('#difficulty')) $('#difficulty').onchange = (e) => sendMsg({ type: 'difficulty', value: e.target.value });
  document.querySelectorAll('.accept').forEach((b) => (b.onclick = () => sendMsg({ type: 'accept' })));

  const board = $('#board');
  if (!board) return;
  if (board.classList.contains('blindfold')) bindDrawing(board);
  else redrawCanvas();
}

function sendGuess() {
  const text = $('#guess').value.trim();
  if (text) sendMsg({ type: 'guess', text });
}

// ---------- Drawing ----------

function drawSeg(canvas, [x0, y0, x1, y1]) {
  if (!canvas || canvas.classList.contains('blindfold')) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1b1820';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
  ctx.lineTo(x1 * canvas.width, y1 * canvas.height);
  ctx.stroke();
}

function redrawCanvas() {
  const canvas = $('#board');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  for (const s of strokes) drawSeg(canvas, s);
}

function bindDrawing(canvas) {
  let last = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    last = pos(e);
  };
  canvas.onpointermove = (e) => {
    if (!last) return;
    const p = pos(e);
    const seg = [...last, ...p];
    strokes.push(seg);
    sendMsg({ type: 'draw', seg });
    last = p;
  };
  canvas.onpointerup = canvas.onpointercancel = () => (last = null);
}
