from http.server import SimpleHTTPRequestHandler, HTTPServer
import socket
import signal
import subprocess
import time
import json
import os

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def load_config():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f'Config file not found: {config_path}')
        return {'mediamtx_path': '/home/hkcrc/mediamtx', 'http_port': 8890}
    except json.JSONDecodeError as e:
        print(f'Error parsing config file: {e}')
        return {'mediamtx_path': '/home/hkcrc/mediamtx', 'http_port': 8890}

def check_and_start_mediamtx(mediamtx_path):
    try:
        # Check if MediaMTX is running
        result = subprocess.run(['pgrep', 'mediamtx'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            print('MediaMTX is not running, starting it...')
            proc = subprocess.Popen([mediamtx_path])
            time.sleep(2)  # Wait for a moment to ensure it starts
            print('MediaMTX started successfully.')
            return proc, True
        print('MediaMTX is already running.')
        return None, False
    except Exception as e:
        print(f'Error checking or starting MediaMTX: {e}')
        return None, False

def find_available_port(start_port=8890, max_tries=50):
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(('', port))
                return port
            except OSError:
                continue
    raise OSError(f'No available port found from {start_port} to {start_port + max_tries - 1}')

def start_http_service(port=8890):
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
    config = load_config()
    mediamtx_proc, started_by_us = check_and_start_mediamtx(config['mediamtx_path'])

    def _handle_exit(signum, frame):
        raise SystemExit

    signal.signal(signal.SIGINT, _handle_exit)
    signal.signal(signal.SIGTERM, _handle_exit)

    try:
        start_http_service(config['http_port'])
    except Exception as e:
        print(f'HTTP server stopped or failed: {e}')
    finally:
        shutdown_mediamtx(mediamtx_proc, started_by_us)