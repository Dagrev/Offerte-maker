import {
  AlertTriangle,
  ArrowLeft,
  FileCheck,
  FileText,
  FolderOpen,
  ListChecks,
  Pencil,
  Printer,
  Sparkles,
} from 'lucide-react';
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
import { isUitgeklapt, useGeleBalk } from '../stores/geleBalk';
import { useNavigatie } from '../stores/navigatie';
import { nl } from '../teksten/nl';
import { ClaudeAanpassen } from './detail/ClaudeAanpassen';
import { EerdereVersies } from './detail/EerdereVersies';
import { KopieEnVerwijderen } from './detail/KopieEnVerwijderen';
import { StatusKnoppen } from './detail/StatusKnoppen';
import { VerstuurPerMail } from './detail/VerstuurPerMail';

// Detailscherm (FO S4, UC-06; TDO §13.4, V-05). Links het voorbeeld (gelijk aan de PDF, FE-050),
// rechts het actiepaneel: definitief en PDF (OFM-015), status, kopie en verwijderen (OFM-016, in
// `detail/`), Laat Claude aanpassen en eerdere versies (OFM-017, in `detail/`), Verstuur per e-mail
// (OFM-041, in `detail/`).

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
  const geleBalkKeuze = useGeleBalk((s) => s.keuze);
  const zetGeleBalk = useGeleBalk((s) => s.zet);

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
        {/* OFM-047: invoer aangepast in de wizard maar niet opnieuw gemaakt. Maak opnieuw start de
            agent; bij een fout gaat het Bezig-scherm terug naar wizardstap 4 (met Maak opnieuw zonder
            Claude). De regel verdwijnt zodra de inhoud opnieuw uit de invoer is gemaakt. */}
        {detail.invoerGewijzigd && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak px-5 py-3 text-waarschuwing">
            <p className="flex items-center gap-3 font-semibold">
              <AlertTriangle aria-hidden="true" className="size-6 shrink-0" />
              {t.invoerGewijzigd}
            </p>
            <Knop
              label={t.maakOpnieuw}
              icoon={Sparkles}
              onClick={() =>
                gaNaar({ scherm: 'bezig', bezig: { id: detail.id, soort: 'maken', terugNaar: 'wizard' } })
              }
            />
          </div>
        )}
        <GeleBalk
          titel={t.controleerEven}
          punten={punten}
          inklappen={{
            uitgeklapt: isUitgeklapt(geleBalkKeuze, detail.id, punten.length),
            opWissel: (uitgeklapt) => zetGeleBalk(detail.id, uitgeklapt),
            aantal: t.aantalPunten(punten.length),
            toon: t.toonPunten,
            verberg: t.verbergPunten,
            lijstNaam: t.controlepunten,
          }}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem] gap-6">
        {/* OFM-054: het voorbeeld heeft een eigen zoomwerkbalk en scrollt zelf (in de houder). */}
        <section aria-label={nl.componenten.pdfVoorbeeld} className="flex min-h-0 flex-col">
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
            {/* OFM-047: Aanpassen opent de wizard met de opgeslagen invoer; Regels bewerken is het oude
                Bewerken-scherm (OFM-014) voor een kleine correctie zonder opnieuw te maken. */}
            <Knop
              label={t.aanpassen}
              icoon={Pencil}
              variant={nogDefinitiefMaken ? 'secundair' : 'hoofd'}
              breed
              onClick={() => gaNaar({ scherm: 'wizard', offerteId: detail.id, wizardStap: 1 })}
            />
            <Knop
              label={t.regelsBewerken}
              icoon={ListChecks}
              breed
              onClick={() => gaNaar({ scherm: 'bewerken', offerteId: detail.id })}
            />
            <ClaudeAanpassen id={detail.id} />
            {/* Open PDF, Afdrukken, Verstuur per e-mail (OFM-041), Toon in map (FE-057): alleen met een PDF. */}
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
                <VerstuurPerMail id={detail.id} status={detail.status} />
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

          <EerdereVersies id={detail.id} versies={detail.versies} />
        </aside>
      </div>
    </main>
  );
}
