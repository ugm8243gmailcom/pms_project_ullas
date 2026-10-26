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

console.log(`[WAYMARK] Seeding demo users using: ${pythonCmd}`);
const proc = spawn(pythonCmd, ['seed_demo_users.py'], {
  stdio: 'inherit',
  cwd: path.join(rootDir, 'pms_backend'),
});

proc.on('close', (code) => {
  process.exit(code || 0);
});
