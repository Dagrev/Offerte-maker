import { useState } from 'react';
import { DatabaseBackup, History } from 'lucide-react';
import type { Fout } from '@shared/fouten';
import type { BackupItem } from '@shared/types';
import { maakBackupNu, useBackups, zetBackupTerug } from '../../api/backups';
import { alsFout } from '../../api/roep';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { nl } from '../../teksten/nl';

const t = nl.backups;

/** `2026-09-25T21:04:09` → `25-09-2026 21:04`. */
function toonTijdstip(tijdstip: string): string {
  const [datum = '', tijd = ''] = tijdstip.split('T');
  const [jaar, maand, dag] = datum.split('-');
  return `${dag}-${maand}-${jaar} ${tijd.slice(0, 5)}`;
}

function soortVan(bestand: string): string {
  const reden = /-(dagelijks|handmatig|voor-migratie|voor-herstel)\.sqlite$/.exec(bestand)?.[1] ?? '';
  return t.soort[reden] ?? reden;
}

/** Instellingen → Geavanceerd → Back-ups (FO UC-16, FE-101). */
export function Backups() {
  const lijst = useBackups();
  const [bezig, setBezig] = useState(false);
  const [signaal, setSignaal] = useState(0);
  const [fout, setFout] = useState<Fout | null>(null);
  const [terugzetten, setTerugzetten] = useState<BackupItem | null>(null);
  const [herstart, setHerstart] = useState(false);

  const maak = async () => {
    setBezig(true);
    setFout(null);
    try {
      await maakBackupNu();
      setSignaal((s) => s + 1);
    } catch (e) {
      setFout(alsFout(e));
    } finally {
      setBezig(false);
    }
  };

  const bevestigTerugzetten = async () => {
    const item = terugzetten;
    setTerugzetten(null);
    if (!item) return;
    setFout(null);
    setHerstart(true);
    // Bij succes herstart de app en komt er geen antwoord; alleen een weigering of fout komt terug.
    const uit = await zetBackupTerug(item.bestand);
    if (!uit.ok) {
      setHerstart(false);
      setFout(uit.fout);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">{t.titel}</h2>
      <p className="max-w-3xl text-tekst-zacht">{t.uitleg}</p>

      <div className="flex flex-wrap items-center gap-4">
        <Knop
          label={t.maakNu}
          variant="hoofd"
          icoon={DatabaseBackup}
          disabled={bezig || herstart}
          onClick={() => void maak()}
        />
        <BewaardIndicator signaal={signaal} />
      </div>

      {herstart && (
        <p role="status" className="rounded-knop bg-vlak px-5 py-4 font-semibold">
          {t.bezigMetTerugzetten}
        </p>
      )}
      {fout && <Foutmelding fout={fout} />}
      {lijst.isError && <Foutmelding fout={alsFout(lijst.error)} opnieuw={() => void lijst.refetch()} />}

      {lijst.isPending ? (
        <p role="status" className="text-tekst-zacht">
          {t.laden}
        </p>
      ) : lijst.data && lijst.data.length === 0 ? (
        <p className="text-tekst-zacht">{t.geen}</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-rand">
              <th className="py-3 pr-4 font-semibold">{t.kolomTijdstip}</th>
              <th className="py-3 pr-4 font-semibold">{t.kolomSoort}</th>
              <th className="py-3 pr-4 text-right font-semibold">{t.kolomGrootte}</th>
              <th className="py-3">
                <span className="sr-only">{t.zetTerug}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lijst.data?.map((item) => (
              <tr key={item.bestand} className="border-b border-rand">
                <td className="py-3 pr-4 tabular-nums">{toonTijdstip(item.tijdstip)}</td>
                <td className="py-3 pr-4">{soortVan(item.bestand)}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{t.grootte(item.grootteBytes)}</td>
                <td className="py-3 text-right">
                  <Knop
                    label={t.zetTerug}
                    aria-label={t.zetTerugVan(toonTijdstip(item.tijdstip))}
                    icoon={History}
                    disabled={herstart}
                    onClick={() => setTerugzetten(item)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Bevestiging
        open={terugzetten !== null}
        titel={t.bevestigTitel}
        bevestigLabel={t.bevestigKnop}
        annuleerLabel={t.annuleer}
        gevaar
        opBevestig={() => void bevestigTerugzetten()}
        opAnnuleer={() => setTerugzetten(null)}
      >
        <p>{terugzetten ? t.bevestigTekst(toonTijdstip(terugzetten.tijdstip)) : ''}</p>
      </Bevestiging>
    </section>
  );
}
