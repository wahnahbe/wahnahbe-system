import chokidar from 'chokidar';

export function createBus() {
  const subs = new Set();
  return {
    emit(type) { for (const fn of subs) fn(type); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export function startWatcher(config, bus, onError = () => {}) {
  const paths = [...Object.values(config.sources), config.stateDir];
  let timer = null;
  const watcher = chokidar.watch(paths, { ignoreInitial: true });
  watcher.on('all', () => {
    clearTimeout(timer);
    timer = setTimeout(() => bus.emit('refresh'), 300);
  });
  watcher.on('error', (err) => onError(err));
  const close = watcher.close.bind(watcher);
  watcher.close = () => { clearTimeout(timer); return close(); };
  return watcher;
}
