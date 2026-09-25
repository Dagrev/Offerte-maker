import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoutCode } from '@shared/fouten';
import type { Voortgang } from '@shared/types';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';

// OFM-024: standaardteksten uit het template (§10.5, §10.7, V-08, FE-084), met de nep-CLI.

const nep = vi.hoisted(() => ({ agentMap: '' }));
vi.mock('electron', () => ({ app: { getPath: () => 'C:\\nergens', isPackaged: false } }));
vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../paden', () => ({
  paden: {
    get agentMap() {
      return nep.agentMap;
    },
  },
}));

const { tekstenUitTemplate, nabewerkVoorstellen, stopTaak, TEMPLATE_TEKSTEN_ID } = await import('./taken');
const { SYSTEEMPROMPT_TEMPLATE_TEKSTEN, verstuurdeTekst } = await import('./prompts');
const { legeStatusCache } = await import('./claudeStatus');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { haalInstelling } = await import('../db/repo/instellingen');
const { maakIpcHandler } = await import('../ipc/registreer');
const { voorbeeldenHandlers } = await import('../ipc/voorbeelden');

const FIXTURE = resolve(import.meta.dirname, '..', '..', '..', 'test', 'fake-claude', 'fixtures');
const TEMPLATE_TEKST =
  'Geachte [VERWIJDERD],\n\nHierbij onze offerte voor uw dak.\n\nMet vriendelijke groet,\n[BEDRIJF]';

let db: TestDatabase;
let claude: NepClaude | undefined;
beforeEach(async () => {
  db = await maakTestDatabase();
  nep.agentMap = mkdtempSync(join(tmpdir(), 'ofm024-'));
  legeStatusCache();
  zetTesthakenVoorTest(new Map());
});
afterEach(() => {
  claude?.opruimen();
  claude = undefined;
  db.opruimen();
  rmSync(nep.agentMap, { recursive: true, force: true });
});

function voegVoorbeeldToe(id: string, status: string, template: boolean, tekst = TEMPLATE_TEKST) {
  db.db
    .prepare("INSERT INTO bestanden (id, naam, mime, inhoud) VALUES (?, 'x.pdf', 'x', x'00')")
    .run(`b-${id}`);
  db.db
    .prepare(
      "INSERT INTO voorbeelden (id, bestandsnaam, bestand_id, tekst_geanonimiseerd, status, is_template, aangemaakt_op) VALUES (?, 'x.pdf', ?, ?, ?, ?, '2026-09-25T10:00:00.000Z')",
    )
    .run(id, `b-${id}`, tekst, status, template ? 1 : 0);
}

const privacylog = () =>
  db.db.prepare('SELECT soort, offerte_id, opdracht, resultaat, foutcode FROM privacylog').all() as {
    soort: string;
    offerte_id: string | null;
    opdracht: string;
    resultaat: string;
    foutcode: string | null;
  }[];

async function foutcode(belofte: Promise<unknown>): Promise<FoutCode | 'geen fout'> {
  try {
    await belofte;
    return 'geen fout';
  } catch (e) {
    return (e as { code: FoutCode }).code;
  }
}

const handler = maakIpcHandler(
  'voorbeelden:tekstenUitTemplate',
  voorbeeldenHandlers['voorbeelden:tekstenUitTemplate'],
);

describe('tekstenUitTemplate (§10.7, FE-084)', { timeout: 30_000 }, () => {
  it('zonder template: VALIDATIE "Er is nog geen template gekozen.", niets verstuurd', async () => {
    claude = gebruikNepClaude('ok');
    voegVoorbeeldToe('v1', 'goedgekeurd', false);
    expect(await handler({} as never, undefined)).toEqual({
      ok: false,
      fout: { code: 'VALIDATIE', melding: 'Er is nog geen template gekozen.' },
    });
    expect(claude.aanroepen().filter((a) => a.args.includes('-p'))).toEqual([]);
    expect(privacylog()).toEqual([]);
  });

  it('nep-CLI ok: nabewerkte voorstellen, één privacylogregel template_teksten, niets opgeslagen', async () => {
    claude = gebruikNepClaude('ok');
    voegVoorbeeldToe('t', 'goedgekeurd', true);
    const tekstenVoor = haalInstelling('teksten');
    const send = vi.fn();

    const uit = await handler({ sender: { isDestroyed: () => false, send } } as never, undefined);

    const fixture = JSON.parse(readFileSync(join(FIXTURE, 'template-teksten-ok.json'), 'utf8')) as Record<
      string,
      string
    >;
    expect(uit).toEqual({
      ok: true,
      data: {
        voorstellen: {
          inleiding: fixture['inleiding'],
          afsluiting: 'Wij hopen u hiermee een passend aanbod te doen. Met vriendelijke groet,',
          betalingsvoorwaarden: fixture['betalingsvoorwaarden'],
          garantie10: fixture['garantie10'],
          garantie20: fixture['garantie20'],
        },
      },
    });

    const [aanroep, ...meer] = claude.aanroepen().filter((a) => a.args.includes('-p'));
    expect(meer).toEqual([]);
    const opdracht = `# Template\n\n${TEMPLATE_TEKST}`;
    expect(aanroep?.stdin).toBe(opdracht);
    expect(aanroep?.args[aanroep.args.indexOf('--json-schema') + 1]).toContain('"garantie10"');
    expect(privacylog()).toEqual([
      {
        soort: 'template_teksten',
        offerte_id: null,
        opdracht: verstuurdeTekst(SYSTEEMPROMPT_TEMPLATE_TEKSTEN, opdracht),
        resultaat: 'ok',
        foutcode: null,
      },
    ]);
    expect(haalInstelling('teksten')).toEqual(tekstenVoor);

    const voortgang = send.mock.calls.map((c) => c[1] as Voortgang);
    expect(voortgang.every((v) => v.id === TEMPLATE_TEKSTEN_ID)).toBe(true);
    expect(voortgang.at(-1)?.fase).toBe('klaar');
  });

  it('Stoppen breekt de aanroep af: AGENT_AFGEBROKEN, logregel afgebroken', async () => {
    claude = gebruikNepClaude('traag');
    voegVoorbeeldToe('t', 'goedgekeurd', true);
    const belofte = tekstenUitTemplate();
    await vi.waitFor(() => expect(claude?.aanroepen().some((a) => a.args.includes('-p'))).toBe(true), {
      timeout: 10_000,
    });
    expect(stopTaak(TEMPLATE_TEKSTEN_ID)).toBe(true);
    expect(await foutcode(belofte)).toBe('AGENT_AFGEBROKEN');
    expect(privacylog()).toMatchObject([{ soort: 'template_teksten', resultaat: 'afgebroken' }]);
  });

  it('fout van de agent komt als foutcode terug; ongeldig antwoord krijgt één nieuwe poging', async () => {
    claude = gebruikNepClaude('ok');
    voegVoorbeeldToe('t', 'goedgekeurd', true);
    const limiet = vi.fn().mockResolvedValue({ ok: false, code: 'LIMIET_BEREIKT', ruw: '' });
    expect(await foutcode(tekstenUitTemplate({ provider: { voerUit: limiet } }))).toBe('LIMIET_BEREIKT');
    const ongeldig = vi.fn().mockResolvedValue({ ok: true, json: { inleiding: 5 }, ruw: '{}' });
    expect(await foutcode(tekstenUitTemplate({ provider: { voerUit: ongeldig } }))).toBe('AGENT_ONBRUIKBAAR');
    expect(ongeldig).toHaveBeenCalledTimes(2);
  });

  it('API-modus (provider direct): de opdracht bevat de volledige templatetekst', async () => {
    claude = gebruikNepClaude('ok');
    voegVoorbeeldToe('t', 'goedgekeurd', true);
    const voerUit = vi
      .fn()
      .mockResolvedValue({ ok: true, json: { voetnoot: '  Prijzen  excl. btw . ' }, ruw: '' });
    expect(await tekstenUitTemplate({ provider: { voerUit } })).toEqual({
      voorstellen: { voetnoot: 'Prijzen excl. btw.' },
    });
    expect(voerUit).toHaveBeenCalledWith(
      expect.objectContaining({
        soort: 'template_teksten',
        systeemprompt: SYSTEEMPROMPT_TEMPLATE_TEKSTEN,
        opdracht: expect.stringContaining('Hierbij onze offerte voor uw dak.') as string,
        timeoutMs: 300_000,
      }),
    );
  });
});

describe('nabewerkVoorstellen (V-08)', () => {
  it('plaatshouders weg, spaties opgeschoond, getrimd, lege voorstellen weg', () => {
    expect(
      nabewerkVoorstellen({
        inleiding: '  Beste [VERWIJDERD],  dank voor uw  aanvraag. ',
        afsluiting: 'Groet,\n  [BEDRIJF]  ',
        voetnoot: '[BEDRIJF] [VERWIJDERD]',
        garantie10: '',
        garantie20: 'Tien  jaar\n\nverzekerd',
      }),
    ).toEqual({
      inleiding: 'Beste, dank voor uw aanvraag.',
      afsluiting: 'Groet,',
      garantie20: 'Tien jaar\n\nverzekerd',
    });
  });
});
