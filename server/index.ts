import { createServer } from 'node:http';
import { handleMockApiRequest } from './mockServer.ts';

const PORT = 8080;

const server = createServer((req, res) => {
  const handled = handleMockApiRequest(req, res);
  if (!handled) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found on Valheim mock server' }));
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🛡️  Valheim Dedicated Server Mock Backend is active!`);
  console.log(`📡 Listening on: http://localhost:${PORT}/api/`);
  console.log(`🎮 Simulating: CharactersVault, Valgrind, Dagr & Nott`);
  console.log(`======================================================\n`);
});
