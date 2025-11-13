const http = require('http');
const httpProxy = require('http-proxy');

const PORT = 8080;

// Créer le proxy
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true
});

// Routes API vers le backend
const apiRoutes = [
  '/api',
  '/auth',
  '/events',
  '/users',
  '/organizations',
  '/attendees',
  '/badges',
  '/uploads',
  '/public'  // Routes publiques (formulaires)
];

// Créer le serveur
const server = http.createServer((req, res) => {
  const isApiRoute = apiRoutes.some(route => req.url.startsWith(route));
  
  const target = isApiRoute 
    ? 'http://localhost:3000'  // Backend NestJS
    : 'http://localhost:5173'; // Frontend Vite

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} → ${target}`);

  proxy.web(req, res, { target }, (err) => {
    console.error(`[ERROR] ${req.url}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway - Service indisponible');
  });
});

// Support WebSocket
server.on('upgrade', (req, socket, head) => {
  const target = 'http://localhost:5173'; // WebSocket Vite HMR
  console.log(`[WS] ${req.url} → ${target}`);
  proxy.ws(req, socket, head, { target });
});

// Gestion des erreurs du proxy
proxy.on('error', (err, req, res) => {
  console.error('[PROXY ERROR]:', err.message);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway');
  }
});

// Démarrer le serveur
server.listen(PORT, () => {
  console.log('════════════════════════════════════════════════════════');
  console.log('🔄 REVERSE PROXY DÉMARRÉ');
  console.log('════════════════════════════════════════════════════════');
  console.log(`Port       : ${PORT}`);
  console.log(`Backend    : http://localhost:3000`);
  console.log(`Frontend   : http://localhost:5173`);
  console.log('════════════════════════════════════════════════════════');
  console.log('');
});
