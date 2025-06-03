const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 5000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function serveFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

const server = http.createServer((req, res) => {
    // Enable CORS for iframe embedding
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let filePath = '.' + req.url;
    
    if (filePath === './') {
        filePath = './demo.html';
    }

    // Handle requests for files in src directory
    if (req.url.startsWith('/src/')) {
        filePath = '.' + req.url;
    }

    serveFile(res, filePath);
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Privacy Browser Demo Server running at http://0.0.0.0:${port}/`);
    console.log('Features demonstrated:');
    console.log('- User Authentication Interface');
    console.log('- Dashboard with Tab Group Management');
    console.log('- Browser Interface with Timer Functionality');
    console.log('- Modern UI Design and Privacy Features');
});