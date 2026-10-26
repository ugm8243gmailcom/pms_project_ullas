const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const winVenv = path.join(rootDir, 'pms_backend', 'venv', 'Scripts', 'python.exe');
const unixVenv = path.join(rootDir, 'pms_backend', 'venv', 'bin', 'python');

let pythonCmd = 'python';
if (process.platform === 'win32' && fs.existsSync(winVenv)) {
  pythonCmd = winVenv;
} else if (fs.existsSync(unixVenv)) {
  pythonCmd = unixVenv;
}

const args = ['-m', 'uvicorn', 'main:app', '--app-dir', 'pms_backend', '--reload', '--host', '0.0.0.0', '--port', '8000'];
console.log(`[WAYMARK] Starting backend using: ${pythonCmd}`);
const proc = spawn(pythonCmd, args, { stdio: 'inherit', cwd: rootDir });

proc.on('close', (code) => {
  process.exit(code || 0);
});
