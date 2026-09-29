import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const electron = require('electron');
const p = spawn(electron, ['.', '--smoke'], { stdio: 'inherit' });
p.on('exit', (c) => process.exit(c ?? 1));
