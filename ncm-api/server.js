const { createServer } = require('http');
const { parse } = require('url');
const netease = require('NeteaseCloudMusicApi');

const PORT = 3001;

const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsed = parse(req.url, true);
  const path = parsed.pathname;
  const query = parsed.query;

  console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);

  try {
    // Map paths to NeteaseCloudMusicApi modules
    const moduleName = path.replace(/^\//, '');
    const moduleFn = netease[moduleName];

    if (!moduleFn) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 404, message: 'Module not found: ' + moduleName }));
      return;
    }

    const result = await moduleFn(query);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body));
  } catch (error) {
    console.error('Error:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 500, message: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`NeteaseCloudMusicApi proxy server running on http://localhost:${PORT}`);
});
