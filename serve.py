#!/usr/bin/env python3
"""Dev server: python3 serve.py [port]

Static files with caching disabled (http.server's heuristic caching serves
stale ES modules otherwise), plus a tiny in-memory relay that live-syncs the
editor with the Figma plugin in figma-plugin/:

  POST /api/design   editor publishes its current design {paint, frame}
  GET  /api/design   plugin pulls it ("Pull from tool")
  POST /api/inbox    plugin drops a mesh read from Figma {width, height, properties}
  GET  /api/inbox    editor polls it; ?since=<seq> returns only newer items

State lives in memory — restart clears it. CORS is open so the Figma plugin
iframe may call these endpoints; the server binds to 127.0.0.1 only.
"""
import json
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

STATE = {
    'design': None,   # {'seq': n, 'payload': {...}} — latest from the editor
    'inbox': None,    # {'seq': n, 'payload': {...}} — latest from Figma
    'seq': 0,
}


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else None

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/design':
            if STATE['design'] is None:
                self._json(404, {'error': 'No design published yet — is the gradient tool open, in mesh mode?'})
            else:
                self._json(200, STATE['design'])
        elif path == '/api/inbox':
            since = 0
            if '?since=' in self.path:
                try:
                    since = int(self.path.split('?since=')[1])
                except ValueError:
                    pass
            item = STATE['inbox']
            if item and item['seq'] > since:
                self._json(200, item)
            else:
                self._json(200, {'seq': item['seq'] if item else 0, 'payload': None})
        else:
            super().do_GET()

    def do_POST(self):
        path = self.path.split('?')[0]
        if path not in ('/api/design', '/api/inbox'):
            self._json(404, {'error': 'unknown endpoint'})
            return
        try:
            payload = self._read_body()
        except (ValueError, json.JSONDecodeError):
            self._json(400, {'error': 'invalid JSON'})
            return
        STATE['seq'] += 1
        slot = 'design' if path == '/api/design' else 'inbox'
        STATE[slot] = {'seq': STATE['seq'], 'payload': payload}
        self._json(200, {'ok': True, 'seq': STATE['seq']})

    def log_message(self, fmt, *args):
        if '/api/' not in (args[0] if args else ''):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5599
    print(f'Serving on http://127.0.0.1:{port} (caching disabled, Figma sync relay at /api/*)')
    HTTPServer(('127.0.0.1', port), Handler).serve_forever()
