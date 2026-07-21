'use strict';
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Real benchmark history on disk. Results are only meaningful if they persist
// and record which machine produced them.
const DIR = path.join(os.homedir(), '.llmbench');
const FILE = path.join(DIR, 'runs.json');

async function readAll() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    // A corrupt file shouldn't wipe history silently — move it aside.
    try {
      await fs.rename(FILE, `${FILE}.corrupt-${Date.now()}`);
    } catch {
      /* best effort */
    }
    return [];
  }
}

async function save(run) {
  await fs.mkdir(DIR, { recursive: true });
  const runs = await readAll();
  const record = { id: crypto.randomUUID(), ...run };
  runs.unshift(record);
  // Keep history bounded; these are small but unbounded growth is a bug.
  const trimmed = runs.slice(0, 200);
  await fs.writeFile(FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  return record;
}

async function list() {
  return readAll();
}

async function clear() {
  try {
    await fs.unlink(FILE);
  } catch {
    /* already gone */
  }
  return { ok: true };
}

module.exports = { save, list, clear, FILE };
