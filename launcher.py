"""
Webcam VR Game Hub - Universal Python Launcher
Starts the server as a detached background daemon and opens Edge/Chrome in App Mode.
"""
import os
import sys
import time
import subprocess
import urllib.request

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PORT = 8765
URL = f"http://localhost:{PORT}"

def is_server_running():
    try:
        resp = urllib.request.urlopen(URL, timeout=1)
        return resp.getcode() == 200
    except Exception:
        return False

def ensure_server():
    if is_server_running():
        return
    
    server_script = os.path.join(DIRECTORY, 'server.py')
    # Windows flags for completely detached background process
    DETACHED_PROCESS = 0x00000008
    CREATE_NEW_PROCESS_GROUP = 0x00000200

    python_exe = sys.executable
    # Prefer pythonw if available for invisible console
    pythonw_candidate = os.path.join(os.path.dirname(python_exe), 'pythonw.exe')
    if os.path.exists(pythonw_candidate):
        python_exe = pythonw_candidate

    subprocess.Popen(
        [python_exe, server_script],
        cwd=DIRECTORY,
        creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
        close_fds=True
    )

    # Wait up to 3 seconds for server to respond
    for _ in range(30):
        time.sleep(0.1)
        if is_server_running():
            break

def launch_browser():
    # Common browser locations for Chrome and Edge
    candidates = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe")
    ]

    browser_exe = None
    for c in candidates:
        if os.path.exists(c):
            browser_exe = c
            break

    if browser_exe:
        subprocess.Popen([browser_exe, f"--app={URL}", "--start-maximized"])
    else:
        # Fallback to default browser
        import webbrowser
        webbrowser.open(URL)

if __name__ == '__main__':
    ensure_server()
    launch_browser()
