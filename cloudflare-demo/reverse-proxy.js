const http = require('http');
const httpProxy = require('http-proxy');

const PORT = 8080;

// Créer le proxy
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true
});

// Routes API backend (doivent être des routes HTTP précises, pas des routes React)
const backendApiPaths = [
  '/api',
  '/auth',
  '/public',       // Formulaires publics
  '/uploads',      // Upload de fichiers
];

// Endpoints REST qui doivent aller au backend SEULEMENT s'ils ne contiennent pas d'UUID
const restEndpoints = [
  '/users',
  '/organizations', 
  '/attendees',
  '/events',
  '/badges',
  '/roles',
  '/permissions',
  '/registrations',
  '/analytics',
  '/reports'
];

// Vérifier si c'est une route API backend
const isApiRoute = (url, headers) => {
  const urlPath = url.split('?')[0]; // Enlever les query params
  
  // Routes API explicites (toujours backend)
  if (backendApiPaths.some(route => urlPath.startsWith(route))) {
    return true;
  }
  
  // Pour les endpoints REST, vérifier qu'il n'y a PAS d'UUID dans le path
  // OU que la requête demande du JSON (header Accept)
  const hasUUID = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(urlPath);
  const acceptsJson = headers && headers.accept && (
    headers.accept.includes('application/json') ||
    headers.accept.includes('*/*')
  );
  
  if (hasUUID) {
    // Si UUID dans l'URL ET que le client accepte JSON, c'est une requête API
    // Sinon c'est une page frontend (navigation/refresh)
    if (acceptsJson && !headers.accept.includes('text/html')) {
      return true; // API call
    }
    return false; // Page frontend
  }
  
  // Sinon, vérifier si c'est un endpoint REST
  return restEndpoints.some(endpoint => urlPath.startsWith(endpoint));
};

// Créer le serveur
const server = http.createServer((req, res) => {
  const target = isApiRoute(req.url, req.headers)
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
