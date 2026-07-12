import { Router } from 'express';

export function eventsRouter(bus) {
  const r = Router();
  r.get('/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    const unsubscribe = bus.subscribe((type) => res.write(`event: ${type}\ndata: {}\n\n`));
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => { unsubscribe(); clearInterval(ping); });
  });
  return r;
}
