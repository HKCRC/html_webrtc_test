from http.server import SimpleHTTPRequestHandler, HTTPServer
import socket
import signal
import subprocess
import time

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def check_and_start_mediamtx():
    try:
        # Check if MediaMTX is running
        result = subprocess.run(['pgrep', 'mediamtx'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            print('MediaMTX is not running, starting it...')
            proc = subprocess.Popen(['/home/craner/mediaMtx/mediamtx'])  # Update this path to the correct location of mediamtx
            time.sleep(2)  # Wait for a moment to ensure it starts
            print('MediaMTX started successfully.')
            return proc, True
        print('MediaMTX is already running.')
        return None, False
    except Exception as e:
        print(f'Error checking or starting MediaMTX: {e}')
        return None, False

def find_available_port(start_port=8888, max_tries=50):
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(('', port))
                return port
            except OSError:
                continue
    raise OSError(f'No available port found from {start_port} to {start_port + max_tries - 1}')

def start_http_service(port=8888):
    chosen_port = find_available_port(port)
    httpd = HTTPServer(('', chosen_port), CustomHandler)
    print(f'Serving HTTP on port {chosen_port}...')
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()

def shutdown_mediamtx(proc, started_by_us):
    if started_by_us and proc and proc.poll() is None:
        print('Stopping MediaMTX...')
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print('MediaMTX stopped.')

if __name__ == '__main__':
    mediamtx_proc, started_by_us = check_and_start_mediamtx()

    def _handle_exit(signum, frame):
        raise SystemExit

    signal.signal(signal.SIGINT, _handle_exit)
    signal.signal(signal.SIGTERM, _handle_exit)

    try:
        start_http_service()
    except Exception as e:
        print(f'HTTP server stopped or failed: {e}')
    finally:
        shutdown_mediamtx(mediamtx_proc, started_by_us)