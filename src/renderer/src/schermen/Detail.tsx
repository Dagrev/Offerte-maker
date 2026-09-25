import { ArrowLeft, FileCheck, FileText, FolderOpen, Pencil, Printer, Sparkles } from 'lucide-react';
import { formatEuro } from '@shared/formatteer';
import { klantWeergave } from '@shared/labels';
import { weergaveNummer } from '@shared/nummering';
import { gelePunten } from '@shared/offerteBewerken';
import type { OfferteDetail } from '@shared/types';
import { useMaakDefinitief, useOfferte, usePdfActie, useVoorbeeldHtml } from '../api/offerte';
import { alsFout } from '../api/roep';
import { Foutmelding } from '../componenten/Foutmelding';
import { GeleBalk } from '../componenten/GeleBalk';
import { Knop } from '../componenten/Knop';
import { PdfVoorbeeld } from '../componenten/PdfVoorbeeld';
import { StatusLabel } from '../componenten/StatusLabel';
import { useNavigatie } from '../stores/navigatie';
import { nl } from '../teksten/nl';
import { KopieEnVerwijderen } from './detail/KopieEnVerwijderen';
import { StatusKnoppen } from './detail/StatusKnoppen';

// Detailscherm (FO S4, UC-06; TDO §13.4, V-05). Links het voorbeeld (gelijk aan de PDF, FE-050),
// rechts het actiepaneel. OFM-015 (definitief, PDF), OFM-016 (status, kopie, verwijderen) en OFM-017
// (Laat Claude aanpassen, eerdere versies terugzetten) sluiten hun knoppen hier aan; tot dan staan
// ze uitgeschakeld op hun plek.

const t = nl.detail;

export function Detail() {
  const offerteId = useNavigatie((s) => s.offerteId);
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const query = useOfferte(offerteId);
  const terug = () => gaNaar({ scherm: 'overzicht' });

  if (query.isError) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
        <TerugKnop opKlik={terug} />
        <Foutmelding fout={alsFout(query.error)} opnieuw={() => void query.refetch()} />
      </main>
    );
  }
  if (!offerteId || !query.data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-tekst-zacht">
          {t.laden}
        </p>
      </main>
    );
  }
  return <DetailInhoud detail={query.data} terug={terug} />;
}

function TerugKnop({ opKlik }: { opKlik: () => void }) {
  return (
    <div>
      <Knop label={t.terugNaarOverzicht} icoon={ArrowLeft} onClick={opKlik} />
    </div>
  );
}

function DetailInhoud({ detail, terug }: { detail: OfferteDetail; terug: () => void }) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const storeFout = useNavigatie((s) => s.fout);
  const voorbeeld = useVoorbeeldHtml(detail.id, detail.inhoud !== null);
  const definitief = useMaakDefinitief(detail.id);
  const pdfActie = usePdfActie(detail.id);

  if (detail.inhoud === null) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
        <TerugKnop opKlik={terug} />
        <p>{t.geenInhoud}</p>
        <div>
          <Knop
            label={t.naarWizard}
            variant="hoofd"
            onClick={() => gaNaar({ scherm: 'wizard', offerteId: detail.id })}
          />
        </div>
      </main>
    );
  }

  const laatstePdf = detail.pdfs.at(-1) ?? null;
  const nummer = weergaveNummer(detail.nummer, laatstePdf?.versieletter ?? null);
  const nogDefinitiefMaken = detail.pdfs.length === 0 || detail.gewijzigdNaDefinitief;
  const punten = gelePunten(detail.inhoud, t.geschattePrijs);

  return (
    <main className="flex h-screen flex-col gap-4 p-6">
      <div className="flex flex-col gap-4">
        <TerugKnop opKlik={terug} />
        {storeFout && <Foutmelding fout={storeFout} />}
        <GeleBalk titel={t.controleerEven} punten={punten} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem] gap-6">
        <section aria-label={nl.componenten.pdfVoorbeeld} className="min-h-0 overflow-y-auto pr-2">
          {voorbeeld.isError ? (
            <Foutmelding fout={alsFout(voorbeeld.error)} opnieuw={() => void voorbeeld.refetch()} />
          ) : (
            <PdfVoorbeeld html={voorbeeld.data?.html ?? null} />
          )}
        </section>

        <aside aria-label={t.acties} className="flex min-h-0 flex-col gap-6 overflow-y-auto">
          <div className="flex flex-col gap-3 rounded-knop bg-vlak p-5">
            <h1 className="text-2xl font-semibold">{nummer ?? t.concept}</h1>
            <p>
              <span className="sr-only">{t.klant}: </span>
              {klantWeergave(detail.klant)}
            </p>
            <div className="flex items-center gap-3">
              <span className="sr-only">{t.status}: </span>
              <StatusLabel status={detail.status} />
            </div>
            {detail.totalen && (
              <p className="flex justify-between gap-4">
                <span className="text-tekst-zacht">{t.totaal}</span>
                <span className="font-semibold tabular-nums">{formatEuro(detail.totalen.totaalCent)}</span>
              </p>
            )}
          </div>

          <StatusKnoppen
            id={detail.id}
            status={detail.status}
            definitief={detail.nummer !== null || detail.pdfs.length > 0}
          />

          <div className="flex flex-col gap-3">
            {/* Fout van Maak definitief of een PDF-actie, met Opnieuw (§15.1). */}
            {definitief.isError && (
              <Foutmelding fout={alsFout(definitief.error)} opnieuw={() => definitief.mutate()} />
            )}
            {pdfActie.isError && pdfActie.variables && (
              <Foutmelding
                fout={alsFout(pdfActie.error)}
                opnieuw={() => pdfActie.mutate(pdfActie.variables)}
              />
            )}
            {/* Maak definitief (FE-054–056): hoofdknop zolang er geen PDF is of na een wijziging. */}
            {nogDefinitiefMaken && (
              <Knop
                label={definitief.isPending ? t.pdfWordtGemaakt : t.maakDefinitief}
                icoon={FileCheck}
                variant="hoofd"
                breed
                disabled={definitief.isPending}
                onClick={() => definitief.mutate()}
              />
            )}
            <Knop
              label={t.aanpassen}
              icoon={Pencil}
              breed
              onClick={() => gaNaar({ scherm: 'bewerken', offerteId: detail.id })}
            />
            {/* Laat Claude aanpassen (FE-053): OFM-017. */}
            <NogNiet label={t.laatClaudeAanpassen} icoon={Sparkles} />
            {/* Open PDF, Afdrukken, Toon in map (FE-057): alleen met een PDF. */}
            {laatstePdf && (
              <>
                <Knop
                  label={t.openPdf}
                  icoon={FileText}
                  breed
                  disabled={pdfActie.isPending}
                  onClick={() => pdfActie.mutate('open')}
                />
                <Knop
                  label={t.afdrukken}
                  icoon={Printer}
                  breed
                  disabled={pdfActie.isPending}
                  onClick={() => pdfActie.mutate('afdrukken')}
                />
                <Knop
                  label={t.toonInMap}
                  icoon={FolderOpen}
                  breed
                  disabled={pdfActie.isPending}
                  onClick={() => pdfActie.mutate('map')}
                />
              </>
            )}
            <KopieEnVerwijderen id={detail.id} />
          </div>

          {/* Eerdere versies met Terugzetten (FE-053): OFM-017 voegt de knop per versie toe. */}
          {detail.versies.length > 1 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{t.eerdereVersies}</h2>
              <ul className="flex flex-col gap-2">
                {detail.versies.map((v) => (
                  <li key={v.id} className="rounded-knop border border-rand p-3">
                    <p className="font-semibold">{t.versie(v.versieNr)}</p>
                    <p className="text-tekst-zacht">
                      {t.versieBron[v.bron] ?? v.bron} · {tijdstip(v.aangemaaktOp)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

/** Knop die een volgend ticket aansluit; tot dan uitgeschakeld. */
function NogNiet({ label, icoon, variant }: Pick<Parameters<typeof Knop>[0], 'label' | 'icoon' | 'variant'>) {
  return <Knop label={label} icoon={icoon} variant={variant} breed disabled title={t.binnenkort} />;
}

/** Opgeslagen tijdstip (ISO) in lokale tijd, bijv. "25-09-2026 14:32". */
function tijdstip(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
}
