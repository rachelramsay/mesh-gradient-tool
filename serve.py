#!/usr/bin/env python3
"""Dev server: python3 serve.py [port]. Static files with caching disabled,
so edits to ES modules show up on plain reload (http.server's heuristic
caching serves stale modules otherwise)."""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5599
    print(f'Serving on http://127.0.0.1:{port} (caching disabled)')
    HTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
