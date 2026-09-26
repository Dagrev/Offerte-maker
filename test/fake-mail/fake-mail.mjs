// Nep-MAPI-hulpscript (OFM-041). Vervangt `resources/mail/mapi.ps1` via OFFERTE_MAKER_MAIL_CMD; wordt
// gestart met `process.execPath` en ELECTRON_RUN_AS_NODE=1. Opent nooit een mailprogramma.
//
// FAKE_MAIL_MODE: ok (standaard, MAPI 0) | afgebroken (MAPI 1) | geen-mapi (MAPI niet aan te roepen,
//                 mailto bekend) | geen-programma (MAPI 2, geen mailto) | crash (exit 1).
//                 Een kommalijst (`geen-mapi,ok`) geldt per aanroep (n-de aanroep = n-de modus, de laatste
//                 blijft gelden); het aantal aanroepen komt uit FAKE_MAIL_LOG.
// FAKE_MAIL_LOG:  pad; elke aanroep voegt een JSON-regel { args, stdin, modus } toe (stdin als object).

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const logPad = process.env.FAKE_MAIL_LOG;
const modi = (process.env.FAKE_MAIL_MODE || 'ok').split(',').map((m) => m.trim());
const eerder =
  logPad && existsSync(logPad) ? readFileSync(logPad, 'utf8').split('\n').filter(Boolean).length : 0;
const modus = modi[Math.min(eerder, modi.length - 1)] || 'ok';

const delen = [];
process.stdin.on('data', (d) => delen.push(d));
process.stdin.on('end', () => {
  const tekst = Buffer.concat(delen).toString('utf8');
  let stdin;
  try {
    stdin = JSON.parse(tekst);
  } catch {
    stdin = tekst;
  }
  if (logPad)
    appendFileSync(logPad, JSON.stringify({ args: process.argv.slice(2), stdin, modus }) + '\n', 'utf8');

  const uitkomsten = {
    ok: { mapi: 0, mailto: true },
    afgebroken: { mapi: 1, mailto: true },
    'geen-mapi': { mapi: null, mailto: true },
    'geen-programma': { mapi: 2, mailto: false },
  };
  if (modus === 'crash') {
    process.stderr.write('Error: boom', () => process.exit(1));
    return;
  }
  process.stdout.write(JSON.stringify(uitkomsten[modus] ?? uitkomsten.ok) + '\n', () => process.exit(0));
});
