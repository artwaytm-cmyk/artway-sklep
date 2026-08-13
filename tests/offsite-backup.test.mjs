import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('bazowa kopia zawiera dokładnie aktywne wydanie atomowe Nginx', async () => {
  const source = await read('ops/backup/artway-backup.sh');
  assert.match(source, /ACTIVE_RELEASE_LINK="\/srv\/artway\/releases\/current"/);
  assert.match(source, /deployed-release\.tar\.zst/);
  assert.match(source, /active_release_commit/);
  assert.match(source, /\.commit \| select/);
  assert.doesNotMatch(source, /\.gitCommit/);
  assert.match(source, /sha256sum[\s\S]*deployed-release\.json/);
  assert.doesNotMatch(source, /srv\/artway\/public/);
});

test('kopia opuszcza VPS wyłącznie po szyfrowaniu AES-256 i lokalnej próbie odczytu', async () => {
  const source = await read('ops/backup/artway-offsite-backup.sh');
  assert.match(source, /--symmetric --cipher-algo AES256/);
  assert.match(source, /--passphrase-file "\$KEY_FILE"/);
  assert.match(source, /--decrypt "\$encrypted_file" \| tar -tf/);
  assert.match(source, /gh release upload/);
  assert.doesNotMatch(source, /echo .*KEY_FILE|cat .*KEY_FILE/);
});

test('test odzyskiwania pobiera kopię z zewnątrz i ma blokadę osobnej bazy', async () => {
  const source = await read('ops/backup/artway-restore-drill.sh');
  assert.match(source, /gh release download/);
  assert.match(source, /sha256sum --check --strict/);
  assert.match(source, /database_name" == "artway_restore_test"/);
  assert.match(source, /pg_restore --exit-on-error/);
  assert.match(source, /DROP SCHEMA public CASCADE/);
});

test('harmonogram wykonuje codzienny offsite i cotygodniowy pełny restore', async () => {
  const offsiteTimer = await read('ops/systemd/artway-offsite-backup.timer');
  const restoreTimer = await read('ops/systemd/artway-restore-drill.timer');
  const workflow = await read('ops/backup/github-offsite-restore.yml');
  assert.match(offsiteTimer, /04:15:00 Europe\/Warsaw/);
  assert.match(restoreTimer, /Sun .*05:30:00 Europe\/Warsaw/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /pg_restore --exit-on-error/);
  assert.match(workflow, /ARTWAY_BACKUP_PASSPHRASE/);
});
