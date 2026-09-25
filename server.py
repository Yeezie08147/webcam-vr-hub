"""
Webcam VR Game Hub - High-Performance Local HTTP Server
Serves static assets, WebAssembly, and audio with proper MIME types and CORS.
"""
import http.server
import socketserver
import os
import sys

PORT = 8765
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class VRHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.wasm'):
            return 'application/wasm'
        elif path.endswith('.tflite'):
            return 'application/octet-stream'
        return super().guess_type(path)

    def log_message(self, format, *args):
        # Silence verbose logging
        pass

def start_server():
    os.chdir(DIRECTORY)
    # Allow port reuse
    with socketserver.TCPServer(("", PORT), VRHandler) as httpd:
        if sys.stdout is not None:
            try:
                print(f"[*] Webcam VR Game Hub Server running at http://localhost:{PORT}")
                sys.stdout.flush()
            except Exception:
                pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    start_server()
