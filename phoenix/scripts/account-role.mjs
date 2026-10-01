// Finds the account fingerprint for an email address, so the owner can make that account an Admin.
// Phoenix never stores email addresses, so an account is found by a one-way fingerprint made with the server's data key.
//   node scripts/account-role.mjs someone@example.com "<path to the file holding PHOENIX_DATA_KEY>"
// Then add the printed fingerprint to the PHOENIX_ADMIN_ACCOUNTS setting on the Phoenix site (comma separated) and redeploy.
// Every new sign-up is a User; only fingerprints listed there are Admins, and only an Admin can open the backend.
import fs from 'node:fs';
import { accountSettings, normaliseEmail, accountId } from '../netlify/functions/_lib/accounts.mjs';
const [email, keyFile] = process.argv.slice(2);
if (!email || !keyFile) { console.log('usage: node scripts/account-role.mjs <email> <file with the data key>'); process.exit(1); }
const lines = fs.readFileSync(keyFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const key = lines.find((l) => /^[A-Za-z0-9+/=]{43,44}$/.test(l));
const s = accountSettings({ PHOENIX_DATA_KEY: key, BREVO_API_KEY: 'x', MAIL_FROM: 'x' });
if (!s.idKey) { console.log('No valid data key found in that file.'); process.exit(1); }
const e = normaliseEmail(email); if (!e) { console.log('That does not look like an email address.'); process.exit(1); }
console.log(accountId(s.idKey, e));
