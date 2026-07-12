async function unwrap(res) {
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.data;
}
export const api = {
  get: (path) => fetch(`/api${path}`).then(unwrap),
  send: (method, path, body) => fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(unwrap),
};
