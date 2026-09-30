// Manages who can sign in to the private backend (/admin/). Only people with the "admin" role get in.
//   node scripts/admin-setup.mjs add <username> [--role admin]   make a person and print where their sign-in details were saved
//   node scripts/admin-setup.mjs role <username> <role>          change someone's role (anything other than "admin" has no access)
//   node scripts/admin-setup.mjs remove <username>
//   node scripts/admin-setup.mjs list
//   node scripts/admin-setup.mjs apply                           push the list to Netlify (secret variables) so it takes effect
// Sign-in details are written to a file on THIS computer (never printed here, never in the repository). The list of people, with
// password hashes and authenticator secrets, is kept in %USERPROFILE%\.phoenix-admin\users.json. Passwords are stored only as
// scrypt hashes on the server. After `apply`, deploy the site so the change is live.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { hashPassword, base32 } from '../netlify/functions/_lib/admin.mjs';

const SITE = process.env.PHOENIX_SITE_ID || 'b6a9244d-4cc5-4fb3-b7b4-2799a1d76074';
const dir = path.join(os.homedir(), '.phoenix-admin'), file = path.join(dir, 'users.json');
fs.mkdirSync(dir, { recursive: true });
const load = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { sessionSecret: randomBytes(48).toString('base64url'), users: {} });
const save = (d) => fs.writeFileSync(file, JSON.stringify(d, null, 2), { mode: 0o600 });
const [cmd, a, b] = process.argv.slice(2);
const d = load(); save(d);

if (cmd === 'add') {
  if (!/^[a-z0-9._-]{2,40}$/i.test(a || '')) throw new Error('usage: add <username> (letters, numbers, . _ -)');
  const role = process.argv.includes('--role') ? process.argv[process.argv.indexOf('--role') + 1] : 'admin';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const password = [...randomBytes(24)].map((x) => alphabet[x % alphabet.length]).join('');
  const totp = base32(randomBytes(20));
  const record = { role, hash: await hashPassword(password), totp, created: new Date().toISOString() };
  const uri = `otpauth://totp/Phoenix%20backend:${encodeURIComponent(a)}?secret=${totp}&issuer=Phoenix%20backend&digits=6&period=30`;
  // Where the sign-in details go: PHOENIX_SIGNIN_DIR if set, else the Desktop if it exists, else the .phoenix-admin folder.
  const desk = path.join(os.homedir(), 'Desktop'), folder = process.env.PHOENIX_SIGNIN_DIR || (fs.existsSync(desk) ? desk : dir);
  const out = path.join(folder, `phoenix-backend-signin-${a}.txt`);
  fs.writeFileSync(out, `Phoenix backend sign-in for ${a} (role: ${role})\n\nAddress:   https://phoenix.neurohubcommunity.org/admin/\nUsername:  ${a}\nPassword:  ${password}\n\nAuthenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Aegis...):\n  Choose "enter a setup key" and type:  ${totp}\n  (name it Phoenix backend, type: time-based, 6 digits, 30 seconds)\n  Or open this link on the phone that has the app:\n  ${uri}\n\nSave the password and the setup key in your password manager, then DELETE THIS FILE.\nYou need the password AND the 6-digit code from the app every time you sign in.\n`, { mode: 0o600 });
  d.users[a] = record; save(d); // only after the sign-in details were safely written, so a person can never exist without their password being recorded
  console.log(`Added "${a}" with role "${role}". Sign-in details were saved to: ${out}\nNext: node scripts/admin-setup.mjs apply, then deploy the site.`);
} else if (cmd === 'role') {
  if (!d.users[a] || !b) throw new Error('usage: role <username> <role>');
  d.users[a].role = b; save(d); console.log(`"${a}" now has role "${b}". ${b === 'admin' ? '' : 'They can no longer sign in to the backend. '}Run apply and deploy.`);
} else if (cmd === 'remove') {
  if (!d.users[a]) throw new Error('no such person'); delete d.users[a]; save(d); console.log(`Removed "${a}". Run apply and deploy.`);
} else if (cmd === 'list') {
  for (const [n, u] of Object.entries(d.users)) console.log(`${n}\trole: ${u.role}\tadded ${u.created}`);
  if (!Object.keys(d.users).length) console.log('(nobody yet)');
} else if (cmd === 'apply') {
  const users = Object.fromEntries(Object.entries(d.users).map(([n, u]) => [n, { role: u.role, hash: u.hash, totp: u.totp }]));
  // Run the Netlify CLI's own script with node (no shell), so quotes and $ signs in the values arrive exactly as they are.
  const globalRoot = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
  const cli = path.join(globalRoot, 'netlify-cli', 'bin', 'run.js');
  if (!fs.existsSync(cli)) throw new Error('Netlify CLI not found at ' + cli);
  const set = (k, v) => execFileSync(process.execPath, [cli, 'env:set', k, v, '--secret', '--context', 'production', '--site', SITE], { stdio: ['ignore', 'pipe', 'pipe'] });
  set('ADMIN_SESSION_SECRET', d.sessionSecret);
  set('ADMIN_USERS', JSON.stringify(users));
  console.log(`Pushed ${Object.keys(users).length} person/people and the session secret to Netlify as secret variables. Deploy the site for it to take effect.`);
} else {
  console.log('commands: add <username> [--role admin] | role <username> <role> | remove <username> | list | apply');
}
