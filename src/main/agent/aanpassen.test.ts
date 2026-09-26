import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoutCode } from '@shared/fouten';
import type { Klant, OfferteInhoud, Voortgang } from '@shared/types';
import { gebruikNepClaude, type NepClaude } from '../../../test/helpers/agent';
import { maakTestDatabase, type TestDatabase } from '../../../test/helpers/database';
import { maakInvoer, maakKlant } from '../../../test/privacy/testset';

// Laat Claude aanpassen en versies terugzetten (OFM-017, §10.7, FE-053, V-06), met de nep-CLI.

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

const { maakOfferte: nieuweOfferte, bewaarInvoer, haalOfferte } = await import('../db/repo/offertesInvoer');
const { bewaarNieuweVersie } = await import('../db/repo/offertesInhoud');
const { pasAanMetClaude, stopTaak, maakOfferte } = await import('./taken');
const { legeStatusCache } = await import('./claudeStatus');
const { zetTesthakenVoorTest } = await import('../testhaken');
const { maakIpcHandler } = await import('../ipc/registreer');
const { offerteAgentHandlers } = await import('../ipc/offerteAgent');

let db: TestDatabase;
let claude: NepClaude | undefined;

beforeEach(async () => {
  db = await maakTestDatabase();
  nep.agentMap = mkdtempSync(join(tmpdir(), 'ofm-aanpassen-'));
  legeStatusCache();
  zetTesthakenVoorTest(new Map());
});
afterEach(() => {
  claude?.opruimen();
  claude = undefined;
  db.opruimen();
  rmSync(nep.agentMap, { recursive: true, force: true });
});

const jansen: Klant = maakKlant({
  voornaam: '',
  achternaam: 'Jansen',
  adres: { straatHuisnummer: 'Dorpsstraat 12', postcode: '5501 AB', plaats: 'Veldhoven' },
  telefoon: '06-12345678',
  email: 'jansen@mail.nl',
});

const inhoud: OfferteInhoud = {
  titel: 'Offerte dak',
  inleiding: 'Beste [KLANT_NAAM], hierbij de offerte.',
  werkomschrijving: ['Stap 1'],
  regels: [
    {
      id: 'a',
      omschrijving: 'Eigen post',
      aantalHonderdsten: 250,
      eenheid: 'post',
      prijsCent: 12345,
      btwTarief: 21,
      prijsbron: 'handmatig',
      prijspostId: null,
    },
  ],
  uitvoering: '',
  opmerkingen: '',
  afsluiting: '',
  controlepunten: ['Oud punt'],
};

function offerteMetInhoud(): string {
  const id = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
  bewaarInvoer({ id, klant: jansen, invoer: maakInvoer(), wizardStap: 4 }, 30);
  bewaarNieuweVersie({ id, inhoud, bron: 'agent', wizardStap: 4 });
  return id;
}

const rij = (id: string) =>
  db.db.prepare('SELECT inhoud_json, gewijzigd_na_definitief FROM offertes WHERE id = ?').get(id) as {
    inhoud_json: string;
    gewijzigd_na_definitief: number;
  };
const versies = (id: string) =>
  db.db
    .prepare(
      'SELECT id, versie_nr AS nr, bron, inhoud_json FROM offerte_versies WHERE offerte_id = ? ORDER BY versie_nr',
    )
    .all(id) as { id: string; nr: number; bron: string; inhoud_json: string }[];
const privacylog = () =>
  db.db.prepare('SELECT soort, opdracht, resultaat FROM privacylog').all() as {
    soort: string;
    opdracht: string;
    resultaat: string;
  }[];
const pAanroepen = () => (claude?.aanroepen() ?? []).filter((a) => a.args.includes('-p'));

async function foutcode(belofte: Promise<unknown>): Promise<FoutCode | 'geen fout'> {
  try {
    await belofte;
    return 'geen fout';
  } catch (e) {
    return (e as { code: FoutCode }).code;
  }
}

describe('pasAanMetClaude (§10.7, FE-053)', { timeout: 30_000 }, () => {
  it('ok: nieuwe versie agent_aanpassing, privacylog aanpassen, opdracht volgens §10.5 zonder PII', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMetInhoud();
    const voortgang: Voortgang[] = [];
    const uit = await pasAanMetClaude(id, 'Bel meneer Jansen op 06 1234 5678 en maak de dakgoot 14 meter', {
      stuur: (v) => voortgang.push(v),
    });
    expect(uit).toEqual({ versieNr: 2 });
    expect(versies(id).map((v) => v.bron)).toEqual(['agent', 'agent_aanpassing']);
    expect(rij(id).gewijzigd_na_definitief).toBe(0);
    const nieuw = JSON.parse(rij(id).inhoud_json) as OfferteInhoud;
    expect(nieuw.titel).toBe('Offerte vervangen dakbedekking plat dak');
    expect(nieuw.regels[0]).not.toHaveProperty('ref');

    const log = privacylog();
    expect(log).toEqual([expect.objectContaining({ soort: 'aanpassen', resultaat: 'ok' })]);
    const opdracht = log[0]?.opdracht ?? '';
    expect(opdracht).toContain('# Opdracht: pas deze offerte aan');
    expect(opdracht).toContain('## Huidige offerte');
    expect(opdracht).toContain('"ref": "r1"');
    expect(opdracht).toContain('"prijsbron": "handmatig"');
    expect(opdracht).toContain('"prijsEuro": 123.45');
    expect(opdracht).toContain('"aantal": 2.5');
    expect(opdracht).not.toContain('Oud punt');
    expect(opdracht).toContain(
      '## Wat moet er anders\nBel meneer [KLANT_NAAM] op [VERWIJDERD] en maak de dakgoot 14 meter',
    );
    expect(opdracht).toContain(
      'Lever de volledige aangepaste offerte. Laat ongewijzigd wat niet genoemd wordt.',
    );
    for (const w of ['Jansen', '1234 5678', 'Dorpsstraat', 'jansen@mail.nl'])
      expect(opdracht).not.toContain(w);

    expect(voortgang.map((v) => v.fase)).toEqual(
      expect.arrayContaining(['controleren', 'versturen', 'verwerken', 'klaar']),
    );
  });

  it('definitieve offerte → gewijzigd_na_definitief = 1', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMetInhoud();
    db.db
      .prepare(
        "INSERT INTO pdf_bestanden (id, offerte_id, versieletter, pad, aangemaakt_op) VALUES ('p', ?, '', 'x', 'x')",
      )
      .run(id);
    await pasAanMetClaude(id, 'Korter graag');
    expect(rij(id).gewijzigd_na_definitief).toBe(1);
  });

  it('ongeldig: 2 aanroepen, AGENT_ONBRUIKBAAR, inhoud ongewijzigd', async () => {
    claude = gebruikNepClaude('ongeldig');
    const id = offerteMetInhoud();
    const voor = rij(id).inhoud_json;
    expect(await foutcode(pasAanMetClaude(id, 'Korter'))).toBe('AGENT_ONBRUIKBAAR');
    expect(pAanroepen()).toHaveLength(2);
    expect(rij(id).inhoud_json).toBe(voor);
    expect(versies(id)).toHaveLength(1);
  });

  it('Stoppen: binnen 2 s AGENT_AFGEBROKEN, inhoud ongewijzigd', async () => {
    claude = gebruikNepClaude('traag');
    const id = offerteMetInhoud();
    const voor = rij(id).inhoud_json;
    const taak = foutcode(pasAanMetClaude(id, 'Korter'));
    await vi.waitFor(() => expect(pAanroepen()).toHaveLength(1), { timeout: 10_000, interval: 50 });
    const gestopt = Date.now();
    expect(stopTaak(id)).toBe(true);
    expect(await taak).toBe('AGENT_AFGEBROKEN');
    expect(Date.now() - gestopt).toBeLessThan(2_000);
    expect(rij(id).inhoud_json).toBe(voor);
  });

  it('eindcontrole blokkeert (filter uit): niets verstuurd, geen privacylogregel', async () => {
    claude = gebruikNepClaude('ok');
    zetTesthakenVoorTest(new Map([['privacyfilter-uit', true]]));
    const id = offerteMetInhoud();
    expect(await foutcode(pasAanMetClaude(id, 'Groet aan Jansen'))).toBe('PRIVACY_GEBLOKKEERD');
    expect(pAanroepen()).toHaveLength(0);
    expect(privacylog()).toEqual([]);
  });

  it('geen inhoud of alleen spaties: VALIDATIE; één taak tegelijk per offerte', async () => {
    claude = gebruikNepClaude('traag');
    const leeg = nieuweOfferte({ vandaag: '2026-09-25', geldigheidDagen: 30 });
    expect(await foutcode(pasAanMetClaude(leeg, 'x'))).toBe('VALIDATIE');
    const id = offerteMetInhoud();
    expect(await foutcode(pasAanMetClaude(id, '   '))).toBe('VALIDATIE');
    const eerste = foutcode(pasAanMetClaude(id, 'Korter'));
    expect(await foutcode(maakOfferte(id))).toBe('VALIDATIE');
    // Terugzetten tijdens een lopende taak wordt ook geweigerd.
    const terug = maakIpcHandler('offerte:zetVersieTerug', offerteAgentHandlers['offerte:zetVersieTerug']);
    expect(await terug({} as IpcMainInvokeEvent, { id, versieId: versies(id)[0]?.id })).toMatchObject({
      ok: false,
      fout: { code: 'VALIDATIE', melding: 'Er wordt al aan deze offerte gewerkt.' },
    });
    stopTaak(id);
    expect(await eerste).toBe('AGENT_AFGEBROKEN');
  });
});

describe('offerte:zetVersieTerug (FE-053)', { timeout: 30_000 }, () => {
  const terug = maakIpcHandler('offerte:zetVersieTerug', offerteAgentHandlers['offerte:zetVersieTerug']);
  const evt = {} as IpcMainInvokeEvent;

  it('na één aanpassing 1 eerdere versie; terugzetten herstelt byte-gelijk en maakt versie 3', async () => {
    claude = gebruikNepClaude('ok');
    const id = offerteMetInhoud();
    await pasAanMetClaude(id, 'Korter');
    const detail = haalOfferte(id);
    expect(detail.versies.slice(1)).toHaveLength(1);
    const oud = versies(id)[0] as { id: string; inhoud_json: string };

    expect(await terug(evt, { id, versieId: oud.id })).toEqual({ ok: true, data: { versieNr: 3 } });
    expect(rij(id).inhoud_json).toBe(oud.inhoud_json);
    expect(versies(id).map((v) => v.bron)).toEqual(['agent', 'agent_aanpassing', 'terugzetten']);
    expect(rij(id).gewijzigd_na_definitief).toBe(0);
  });

  it('definitief → gewijzigd_na_definitief = 1; versie van een andere offerte of onbekend → VALIDATIE', async () => {
    const id = offerteMetInhoud();
    const ander = offerteMetInhoud();
    db.db.prepare("UPDATE offertes SET nummer = '2026-001' WHERE id = ?").run(id);
    const eigen = versies(id)[0]?.id;
    expect(await terug(evt, { id, versieId: eigen })).toMatchObject({ ok: true });
    expect(rij(id).gewijzigd_na_definitief).toBe(1);
    for (const invoer of [
      { id, versieId: versies(ander)[0]?.id },
      { id, versieId: 'bestaat-niet' },
      { id, versieId: '' },
      { id },
      { versieId: eigen },
    ]) {
      expect(await terug(evt, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    }
  });

  it('pasAanMetClaude weigert ongeldige invoer (NFE-014)', async () => {
    const aanpas = maakIpcHandler('offerte:pasAanMetClaude', offerteAgentHandlers['offerte:pasAanMetClaude']);
    const id = offerteMetInhoud();
    for (const invoer of [
      { id },
      { id, instructie: '' },
      { id, instructie: 'x'.repeat(2001) },
      { instructie: 'x' },
    ]) {
      expect(await aanpas(evt, invoer)).toMatchObject({ ok: false, fout: { code: 'VALIDATIE' } });
    }
  });
});
