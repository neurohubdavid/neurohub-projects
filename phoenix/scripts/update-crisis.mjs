// Applies the results of the 2026-09-29 helpline verification (each line checked against the provider's own site or a
// second reliable source) to app/data/crisis.json. Kept so the change is reviewable.
import fs from 'node:fs';
const f = new URL('../app/data/crisis.json', import.meta.url);
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
d._note = 'Curated crisis and emergency contacts. Last verified against each provider’s own website (or a second reliable source) on the date in lastReviewed. Re-check every few months: numbers change. Text and chat options are listed first because many neurodivergent people find phone calls hard.';
d.lastReviewed = '2026-09-29';
delete d.verifiedNote;
const L = (name, how, detail, type) => ({ name, how, detail, type });
d.countries.GB.lines = [
  L('Shout (text)', 'Text SHOUT to 85258', 'Free, confidential, 24/7 text support', 'text'),
  L('Samaritans', 'Call 116 123', 'Free, any time, from any phone', 'call'),
  L('NHS 111', 'Call 111 and choose the mental health option', 'Urgent mental health advice (England)', 'call'),
];
d.countries.IE.lines = [
  L('Text About It', 'Text 50808', 'Free, 24/7 text support', 'text'),
  L('Pieta', 'Call 1800 247 247, or text HELP to 51444', 'Suicide and self-harm crisis support, 24/7 (standard text rates apply to 51444)', 'text'),
  L('Samaritans Ireland', 'Call 116 123', 'Free, 24/7', 'call'),
];
d.countries.NZ.lines = [
  L('1737 Need to talk?', 'Call or text 1737', 'Free, confidential, 24/7', 'text'),
  L('Lifeline Aotearoa', 'Call 0800 543 354, or text HELP to 4357', 'Free helpline and text', 'text'),
  L('Suicide Crisis Helpline', 'Call 0508 828 865', 'Free', 'call'),
];
d.countries.NL.lines = [L('113 Zelfmoordpreventie', 'Call 113, or free on 0800-0113. Chat at 113.nl', 'Anonymous, 24/7', 'text')];
d.countries.SG.lines = [
  L('SOS CareText (WhatsApp)', 'WhatsApp 9151 1767', 'Samaritans of Singapore, 24/7', 'text'),
  L('Samaritans of Singapore', 'Call 1767', '24/7, free', 'call'),
];
d.countries.IN.lines = [L('Tele-MANAS', 'Call 14416 or 1-800-891-4416', 'Government mental health helpline, free', 'call')];
d.countries.DE.lines = [L('Telefonseelsorge', 'Call 0800 111 0 111, 0800 111 0 222 or 116 123. Chat and email at telefonseelsorge.de', 'Free, day and night', 'call')];
d.countries.CA.lines = [L('9-8-8 Suicide Crisis Helpline', 'Call or text 988', 'Free, 24/7, run by the Public Health Agency of Canada', 'text')];
d.countries.US.lines = [
  L('988 Suicide & Crisis Lifeline', 'Call or text 988, or chat at chat.988lifeline.org', 'Free, 24/7', 'text'),
  L('Crisis Text Line', 'Text HOME to 741741', 'Free, 24/7 text support', 'text'),
];
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
console.log('countries:', Object.keys(d.countries).length, 'lastReviewed:', d.lastReviewed);
