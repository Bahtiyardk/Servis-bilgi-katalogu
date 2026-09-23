const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createServer, resolveFilePath } = require('../server');

const authHeader = `Basic ${Buffer.from('admin:43214321').toString('base64')}`;

test('requires basic auth for site access', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate') || '', /Basic/i);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('serves site files when valid basic auth is provided', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { Authorization: authHeader },
    });

    assert.equal(response.status, 200);
    assert.match(await response.text(), /Servis Bilgi Kataloğu/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('blocks path traversal outside public directory', () => {
  const resolvedPath = resolveFilePath('/../README.md');
  const publicDir = path.resolve(path.join(__dirname, '..', 'public'));

  assert.equal(resolvedPath, path.join(publicDir, 'README.md'));
  assert.ok(resolvedPath.startsWith(publicDir));
});
