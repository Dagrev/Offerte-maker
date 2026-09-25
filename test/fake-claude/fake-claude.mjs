// Nep-Claude-CLI (TDO §15.2, NFE-022, V-08). Wordt gestart met `process.execPath` en
// ELECTRON_RUN_AS_NODE=1 via OFFERTE_MAKER_CLAUDE_CMD.
//
// FAKE_CLAUDE_MODE: ok (standaard) | oud | niet-ingelogd | ongeldig | leeg | crash | traag | limiet |
//                   geen-internet | ongeldig-dan-ok | geen-versie (extra: --version zonder versienummer)
// FAKE_CLAUDE_LOG:  pad; elke aanroep voegt een JSON-regel { args, stdin } toe.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const map = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const modus = process.env.FAKE_CLAUDE_MODE || 'ok';
const logPad = process.env.FAKE_CLAUDE_LOG;

function logAanroep(stdin) {
  if (logPad) appendFileSync(logPad, JSON.stringify({ args, stdin }) + '\n', 'utf8');
}

function fixture(naam) {
  return JSON.parse(readFileSync(join(map, 'fixtures', naam), 'utf8'));
}

function leesStdin() {
  return new Promise((klaar) => {
    const delen = [];
    process.stdin.on('data', (d) => delen.push(d));
    process.stdin.on('end', () => klaar(Buffer.concat(delen).toString('utf8')));
    process.stdin.on('error', () => klaar(Buffer.concat(delen).toString('utf8')));
  });
}

function schrijfEnStop(tekst, exitCode = 0, kanaal = process.stdout) {
  kanaal.write(tekst, () => process.exit(exitCode));
}

function resultaat(structuredOutput) {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '',
    structured_output: structuredOutput,
    session_id: 'test',
  });
}

/** V-08: het antwoord hangt af van het --json-schema-argument. */
function antwoordVoorSchema() {
  const i = args.indexOf('--json-schema');
  const schemaTekst = i >= 0 ? (args[i + 1] ?? '') : '';
  if (schemaTekst.includes('"garantie10"')) return fixture('template-teksten-ok.json');
  try {
    const schema = JSON.parse(schemaTekst);
    const eigenschappen = Object.keys(schema?.properties ?? {});
    if (eigenschappen.length === 1 && eigenschappen[0] === 'ok') return { ok: true };
  } catch {
    // geen geldig schema: val terug op de offerte
  }
  return fixture('offerte-ok.json');
}

function volgendeTeller() {
  if (!logPad) throw new Error('ongeldig-dan-ok vereist FAKE_CLAUDE_LOG');
  const pad = `${logPad}.teller`;
  const n = existsSync(pad) ? Number(readFileSync(pad, 'utf8')) || 0 : 0;
  writeFileSync(pad, String(n + 1), 'utf8');
  return n;
}

async function afdrukModus() {
  const stdin = await leesStdin();
  logAanroep(stdin);
  let effectief = modus;
  if (modus === 'ongeldig-dan-ok') effectief = volgendeTeller() === 0 ? 'ongeldig' : 'ok';

  switch (effectief) {
    case 'ongeldig': {
      const inhoud = antwoordVoorSchema();
      delete inhoud.regels;
      return schrijfEnStop(resultaat(inhoud));
    }
    case 'leeg':
      return process.exit(0);
    case 'crash':
      return schrijfEnStop('Error: boom\n', 1, process.stderr);
    case 'traag':
      setTimeout(() => schrijfEnStop(resultaat(antwoordVoorSchema())), 400_000);
      return;
    case 'niet-ingelogd':
      return schrijfEnStop(
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          is_error: true,
          result: 'Not logged in · Please run /login',
        }),
        1,
      );
    case 'limiet':
      return schrijfEnStop(
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          is_error: true,
          result: 'Claude usage limit reached',
        }),
        1,
      );
    case 'geen-internet':
      return schrijfEnStop('getaddrinfo ENOTFOUND api.anthropic.com\n', 1, process.stderr);
    default:
      return schrijfEnStop(resultaat(antwoordVoorSchema()));
  }
}

if (args.includes('--version')) {
  logAanroep('');
  if (modus === 'geen-versie') schrijfEnStop('Claude Code\n');
  else schrijfEnStop(modus === 'oud' ? '2.1.100 (Claude Code)\n' : '2.1.270 (Claude Code)\n');
} else if (args[0] === 'auth' && args[1] === 'status') {
  logAanroep('');
  if (modus === 'niet-ingelogd') schrijfEnStop('{"loggedIn":false}\n', 1);
  else schrijfEnStop('{"loggedIn":true}\n');
} else if (args[0] === 'auth' && args[1] === 'login') {
  logAanroep('');
  setTimeout(() => process.exit(0), 500);
} else if (args.includes('-p')) {
  await afdrukModus();
} else {
  logAanroep('');
  schrijfEnStop(`onbekende aanroep: ${args.join(' ')}\n`, 2, process.stderr);
}
