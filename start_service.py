import os
import subprocess
import time

def check_and_start_mediamtx():
    try:
        # Check if MediaMTX is running
        result = subprocess.run(['pgrep', 'mediamtx'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            print('MediaMTX is not running, starting it...')
            # Update the command to start MediaMTX if it's not found
            subprocess.Popen(['/home/hkcrc/mediamtx'])  # Update this path to the correct location of mediamtx
            time.sleep(2)  # Wait for a moment to ensure it starts
            print('MediaMTX started successfully.')
        else:
            print('MediaMTX is already running.')
    except Exception as e:
        print(f'Error checking or starting MediaMTX: {e}')

def start_http_service():
    # Replace this with the command to start your HTTP service
    print('Starting HTTP service...')
    subprocess.Popen(['node', 'app.js'])  # Example command to start HTTP service

if __name__ == '__main__':
    check_and_start_mediamtx()
    start_http_service()