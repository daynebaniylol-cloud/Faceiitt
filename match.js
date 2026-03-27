// api/match.js — Vercel Serverless matchmaking
// Очередь хранится в глобальной переменной (живёт пока инстанс жив)
// Long-polling: игрок висит до 55 сек, потом таймаут

if (!global._queue) global._queue = [];

export default async function handler(req, res) {
  const nick = req.query.nick || 'Игрок';

  // Генерируем уникальный ID для этого игрока
  const myId = Math.random().toString(36).slice(2, 10);

  // Если уже есть кто-то в очереди — матч найден
  const opponent = global._queue.shift();
  if (opponent) {
    // Сообщаем обоим: roomId = myId, хост = opponent
    opponent.resolve({
      roomId: myId,
      role: 'host',        // первый — хост PeerJS
      opponentNick: nick,
    });
    return res.json({
      roomId: myId,
      role: 'guest',       // второй — гость, коннектится к хосту
      opponentNick: opponent.nick,
    });
  }

  // Никого нет — встаём в очередь и ждём
  let resolveMe;
  const waitPromise = new Promise(resolve => { resolveMe = resolve; });

  const entry = { nick, resolve: resolveMe, id: myId };
  global._queue.push(entry);

  // Таймаут 55 сек (Vercel serverless лимит 60 сек)
  const timeout = setTimeout(() => {
    const idx = global._queue.indexOf(entry);
    if (idx !== -1) global._queue.splice(idx, 1);
    resolveMe(null);
  }, 55000);

  const result = await waitPromise;
  clearTimeout(timeout);

  if (!result) {
    return res.status(408).json({ error: 'timeout' });
  }

  return res.json(result);
}
