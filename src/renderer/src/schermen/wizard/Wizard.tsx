import { useEffect, useRef, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { ArrowLeft, ArrowRight, FileText, Sparkles } from 'lucide-react';
import { berekenGeldigTot } from '@shared/periode';
import { leesDatum } from '@shared/formatteer';
import type { Klant, KlusInvoer, OfferteDetail } from '@shared/types';
import { klantCompleet } from '@shared/wizardControle';
import { useOpnieuwInloggen } from '../../api/agentTaak';
import { useClaudeStatus } from '../../api/claude';
import { useAutoBewaarInvoer, useOfferte } from '../../api/offerte';
import { alsFout } from '../../api/roep';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { Stappenbalk } from '../../componenten/Stappenbalk';
import { markeerMislukt, toonZonderClaude } from '../../stores/mislukteMaken';
import { useNavigatie, type WizardStap } from '../../stores/navigatie';
import { nl } from '../../teksten/nl';
import { StapDak } from './StapDak';
import { StapExtras } from './StapExtras';
import { StapKlant } from './StapKlant';
import { StapOverig } from './StapOverig';

const t = nl.wizard;

function alsStap(n: number): WizardStap {
  return n <= 1 ? 1 : n >= 4 ? 4 : (n as WizardStap);
}

/** Wizard nieuwe offerte (FO UC-04, S2; TDO §13.4). Opent op de stap uit de store of de opgeslagen stap. */
export function Wizard() {
  const offerteId = useNavigatie((s) => s.offerteId);
  const gaNaar = useNavigatie((s) => s.gaNaar);
  // Altijd vers ophalen: de formulierstate wordt één keer uit de database gevuld.
  const query = useOfferte(offerteId, { vers: true });

  if (query.isError) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
        <TerugKnop opKlik={() => gaNaar({ scherm: 'overzicht' })} />
        <Foutmelding fout={alsFout(query.error)} opnieuw={() => void query.refetch()} />
      </main>
    );
  }
  if (!offerteId || !query.data || !query.isFetchedAfterMount) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-tekst-zacht">
          {t.laden}
        </p>
      </main>
    );
  }
  return <WizardFormulier key={offerteId} detail={query.data} />;
}

function TerugKnop({ opKlik }: { opKlik: () => void }) {
  return (
    <div>
      <Knop label={t.terugNaarOverzicht} icoon={ArrowLeft} onClick={opKlik} />
    </div>
  );
}

function WizardFormulier({ detail }: { detail: OfferteDetail }) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const vandaag = useNavigatie((s) => s.vandaag);
  const storeStap = useNavigatie((s) => s.wizardStap);
  const storeFout = useNavigatie((s) => s.fout);
  const opnieuwInloggen = useOpnieuwInloggen();
  const bewaar = useAutoBewaarInvoer(detail.id);
  const claudeStatus = useClaudeStatus();
  // V-09: terug van het Bezig-scherm met een fout = een mislukte poging in deze sessie. De markering
  // blijft staan als de gebruiker weggaat en later terugkomt; `storeFout` alleen niet.
  useEffect(() => {
    if (storeFout !== undefined) markeerMislukt(detail.id);
  }, [storeFout, detail.id]);
  const zonderClaudeZichtbaar = storeFout !== undefined || toonZonderClaude(claudeStatus, detail.id);

  // Lokale formulierstate (§13.4). De refs houden de nieuwste waarde vast voor snel na elkaar
  // volgende wijzigingen; de state zorgt voor het renderen.
  const [klant, setKlant] = useState(detail.klant);
  const [invoer, setInvoer] = useState(detail.invoer);
  const [offertedatum, setOffertedatum] = useState(detail.offertedatum);
  const [stap, setStap] = useState<WizardStap>(alsStap(storeStap ?? detail.wizardStap));
  const [toonFouten, setToonFouten] = useState(false);
  const klantRef = useRef(klant);
  const invoerRef = useRef(invoer);

  // Geldigheid in dagen zoals main die bij `offerte:nieuw` gebruikte (teksten.geldigheidDagen).
  const geldigheidDagen = differenceInCalendarDays(
    leesDatum(detail.geldigTot),
    leesDatum(detail.offertedatum),
  );

  const wijzigKlant = (nieuw: Klant) => {
    klantRef.current = nieuw;
    setKlant(nieuw);
    bewaar.plan({ klant: nieuw });
  };
  const wijzigInvoer = (deel: Partial<KlusInvoer>) => {
    const nieuw = { ...invoerRef.current, ...deel };
    invoerRef.current = nieuw;
    setInvoer(nieuw);
    bewaar.plan({ invoer: nieuw });
  };
  const wijzigDatum = (datum: string) => {
    const geldig = datum === '' ? vandaag : datum;
    setOffertedatum(geldig);
    bewaar.plan({ offertedatum: geldig });
  };

  /** Naar een andere stap; stap 1 → verder alleen met naam en plaats (FE-024). Direct bewaren (FE-025). */
  const naarStap = (doel: number) => {
    if (doel > 1 && stap === 1 && !klantCompleet(klantRef.current)) {
      setToonFouten(true);
      return;
    }
    const nieuw = alsStap(doel);
    setStap(nieuw);
    bewaar.plan({ wizardStap: nieuw });
    void bewaar.nu();
    window.scrollTo({ top: 0 });
  };

  const terug = () => {
    void bewaar.nu();
    gaNaar({ scherm: 'overzicht' });
  };

  const maak = async (soort: 'maken' | 'zonder_claude' = 'maken') => {
    if (!klantCompleet(klantRef.current)) {
      setStap(1);
      setToonFouten(true);
      return;
    }
    await bewaar.nu();
    // Het Bezig-scherm (OFM-013) start `offerte:maak` of `offerte:maakZonderClaude` (OFM-025); na
    // succes naar het detailscherm, na een fout terug naar stap 4 (V-07).
    gaNaar({ scherm: 'bezig', bezig: { id: detail.id, soort, terugNaar: 'wizard' } });
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-10 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <TerugKnop opKlik={terug} />
        <BewaardIndicator signaal={bewaar.signaal} />
      </div>
      <h1 className="text-3xl font-semibold">{t.titel}</h1>
      <Stappenbalk stappen={t.stappen} huidig={stap} opKies={naarStap} />

      {storeFout && (
        <Foutmelding fout={storeFout} opnieuw={() => void maak()} opnieuwInloggen={opnieuwInloggen} />
      )}
      {bewaar.fout !== null && <Foutmelding fout={alsFout(bewaar.fout)} />}

      <section aria-labelledby="wizard-stap-titel" className="flex flex-col gap-6">
        <h2 id="wizard-stap-titel" className="text-2xl font-semibold">
          {stap}. {t.stappen[stap - 1]}
        </h2>
        {stap === 1 && <StapKlant klant={klant} opWijzig={wijzigKlant} toonFouten={toonFouten} />}
        {stap === 2 && <StapDak invoer={invoer} opWijzig={wijzigInvoer} />}
        {stap === 3 && <StapExtras invoer={invoer} opWijzig={wijzigInvoer} />}
        {stap === 4 && (
          <StapOverig
            klant={klant}
            invoer={invoer}
            opWijzigInvoer={wijzigInvoer}
            offertedatum={offertedatum}
            opWijzigDatum={wijzigDatum}
            geldigTot={berekenGeldigTot(offertedatum, geldigheidDagen)}
          />
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rand pt-6">
        {stap > 1 ? <Knop label={t.vorige} icoon={ArrowLeft} onClick={() => naarStap(stap - 1)} /> : <span />}
        {stap < 4 ? (
          <Knop label={t.volgende} variant="hoofd" icoon={ArrowRight} onClick={() => naarStap(stap + 1)} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            {/* V-09: alleen bij een statusfout of na een mislukte poging voor deze offerte. */}
            {zonderClaudeZichtbaar && (
              <Knop label={t.maakZonderClaude} icoon={FileText} onClick={() => void maak('zonder_claude')} />
            )}
            <Knop label={t.maakDeOfferte} variant="hoofd" icoon={Sparkles} onClick={() => void maak()} />
          </div>
        )}
      </div>
    </main>
  );
}
