import fs from 'node:fs';

export function readVaultSection(file, parser) {
  try {
    return { ok: true, data: parser(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    return { ok: false, error: `${file}: ${err.message}` };
  }
}
