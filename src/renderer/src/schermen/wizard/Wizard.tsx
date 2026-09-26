import { useEffect, useRef, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { AlertTriangle, ArrowLeft, ArrowRight, FileText, Sparkles } from 'lucide-react';
import { berekenGeldigTot } from '@shared/periode';
import { leesDatum } from '@shared/formatteer';
import { alsKeuzes, vraagtNieuweBedekking } from '@shared/keuzelijsten';
import type {
  GekozenWerkzaamheid,
  Keuzelijsten,
  Klant,
  KlusInvoer,
  OfferteDetail,
  WerkzaamhedenSet,
} from '@shared/types';
import { werkInfo } from '@shared/werkzaamheden';
import { bewaarbareKlant } from '@shared/validatie';
import { puntTekst } from '@shared/teksten/wizardPunten';
import type { Verplicht } from '@shared/verplicht';
import { ontbrekendInStap1, puntSleutel, wizardPunten, type WizardPunt } from '@shared/wizardControle';
import { useOpnieuwInloggen } from '../../api/agentTaak';
import { useInstellingen } from '../../api/instellingen';
import { useKeuzelijsten } from '../../api/keuzelijsten';
import { useWerkzaamheden } from '../../api/werkzaamheden';
import { useAutoBewaarInvoer, useOfferte } from '../../api/offerte';
import { alsFout } from '../../api/roep';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { stapMarkeringen } from '../../componenten/stapMarkering';
import { Stappenbalk } from '../../componenten/Stappenbalk';
import { markeerMislukt } from '../../stores/mislukteMaken';
import { useNavigatie, type WizardStap } from '../../stores/navigatie';
import { nl } from '../../teksten/nl';
import { StapDak } from './StapDak';
import { StapWerkzaamheden } from './StapWerkzaamheden';
import { StapKlant } from './StapKlant';
import { StapOverig } from './StapOverig';

const t = nl.wizard;

function alsStap(n: number): WizardStap {
  return n <= 1 ? 1 : n >= 4 ? 4 : (n as WizardStap);
}

/**
 * Wizard nieuwe offerte (FO UC-04, S2; TDO §13.4). Opent op de stap uit de store of de opgeslagen stap.
 * Sinds OFM-047 ook "Offerte aanpassen" (FO UC-06): zelfde stappen voor een offerte die al inhoud heeft.
 */
export function Wizard() {
  const offerteId = useNavigatie((s) => s.offerteId);
  const gaNaar = useNavigatie((s) => s.gaNaar);
  // Altijd vers ophalen: de formulierstate wordt één keer uit de database gevuld.
  const query = useOfferte(offerteId, { vers: true });
  const keuzelijsten = useKeuzelijsten();
  // OFM-038: welke velden verplicht zijn (Instellingen › Verplichte velden).
  // OFM-044: werkzaamheden en materialen uit de instellingen (stap 3, namen in de samenvatting).
  const werkzaamheden = useWerkzaamheden();
  const instellingen = useInstellingen();
  const fout = [query, keuzelijsten, instellingen, werkzaamheden].find((q) => q.isError)?.error ?? null;

  if (fout !== null) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
        <TerugKnop opKlik={() => gaNaar({ scherm: 'overzicht' })} />
        <Foutmelding
          fout={alsFout(fout)}
          opnieuw={() => {
            void query.refetch();
            void keuzelijsten.refetch();
            void instellingen.refetch();
            void werkzaamheden.refetch();
          }}
        />
      </main>
    );
  }
  if (
    !offerteId ||
    !query.data ||
    !query.isFetchedAfterMount ||
    !keuzelijsten.data ||
    !instellingen.data ||
    !werkzaamheden.data
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-tekst-zacht">
          {t.laden}
        </p>
      </main>
    );
  }
  return (
    <WizardFormulier
      key={offerteId}
      detail={query.data}
      keuzelijsten={keuzelijsten.data}
      verplicht={instellingen.data.verplicht}
      set={werkzaamheden.data}
    />
  );
}

function TerugKnop({ opKlik, label = t.terugNaarOverzicht }: { opKlik: () => void; label?: string }) {
  return (
    <div>
      <Knop label={label} icoon={ArrowLeft} onClick={opKlik} />
    </div>
  );
}

/**
 * Wat er nog ontbreekt (OFM-035): één regio met `role="alert"`, per punt de tekst en een knop naar de
 * stap waar het hoort. Verdwijnt vanzelf als alles in orde is.
 */
function Samenvatting({ punten, opNaarStap }: { punten: WizardPunt[]; opNaarStap: (stap: number) => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak p-5 text-waarschuwing"
    >
      <p className="flex items-center gap-3 text-xl font-semibold">
        <AlertTriangle aria-hidden="true" className="size-6 shrink-0" />
        {t.punten.kop}
      </p>
      <p>{t.punten.uitleg}</p>
      <ul className="flex flex-col gap-3">
        {punten.map((punt) => (
          <li key={puntSleutel(punt)} className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold">{puntTekst(punt)}</span>
            <Knop
              label={t.punten.naarStap(punt.stap)}
              icoon={ArrowRight}
              onClick={() => opNaarStap(punt.stap)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function WizardFormulier({
  detail,
  keuzelijsten,
  verplicht,
  set,
}: {
  detail: OfferteDetail;
  keuzelijsten: Keuzelijsten;
  verplicht: Verplicht;
  set: WerkzaamhedenSet;
}) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const vandaag = useNavigatie((s) => s.vandaag);
  const storeStap = useNavigatie((s) => s.wizardStap);
  const storeFout = useNavigatie((s) => s.fout);
  const opnieuwInloggen = useOpnieuwInloggen();
  const bewaar = useAutoBewaarInvoer(detail.id);
  // V-09: terug van het Bezig-scherm met een fout = een mislukte poging in deze sessie. De markering
  // blijft staan als de gebruiker weggaat en later terugkomt; `storeFout` alleen niet.
  useEffect(() => {
    if (storeFout !== undefined) markeerMislukt(detail.id);
  }, [storeFout, detail.id]);

  // Lokale formulierstate (§13.4). De refs houden de nieuwste waarde vast voor snel na elkaar
  // volgende wijzigingen; de state zorgt voor het renderen.
  const [klant, setKlant] = useState(detail.klant);
  const [invoer, setInvoer] = useState(detail.invoer);
  const [offertedatum, setOffertedatum] = useState(detail.offertedatum);
  const [stap, setStap] = useState<WizardStap>(alsStap(storeStap ?? detail.wizardStap));
  const [toonFouten, setToonFouten] = useState(false);
  // OFM-035: na een poging tot maken met open punten de samenvatting tonen (tot alles in orde is).
  const [toonSamenvatting, setToonSamenvatting] = useState(false);
  const klantRef = useRef(klant);
  // OFM-030: de laatst bewaarde klant; een ongeldig veld gaat met deze waarde mee naar main.
  const bewaardeKlantRef = useRef(detail.klant);
  const invoerRef = useRef(invoer);

  // Geldigheid in dagen zoals main die bij `offerte:nieuw` gebruikte (teksten.geldigheidDagen).
  const geldigheidDagen = differenceInCalendarDays(
    leesDatum(detail.geldigTot),
    leesDatum(detail.offertedatum),
  );

  const wijzigKlant = (nieuw: Klant) => {
    klantRef.current = nieuw;
    setKlant(nieuw);
    bewaardeKlantRef.current = bewaarbareKlant(nieuw, bewaardeKlantRef.current);
    bewaar.plan({ klant: bewaardeKlantRef.current });
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

  // OFM-035: live de punten die nog ontbreken of ongeldig zijn; ze blokkeren alleen het maken.
  const werkLabel = (w: GekozenWerkzaamheid) => werkInfo(set, w).label;
  // OFM-050: de nieuwe dakbedekking telt alleen bij een soort werk die erom vraagt.
  const vraagtBedekking = (soortWerk: string) => vraagtNieuweBedekking(keuzelijsten, soortWerk);
  const punten = wizardPunten(klant, invoer, verplicht, werkLabel, vraagtBedekking);

  /** Naar een andere stap: altijd toegestaan (OFM-035). Direct bewaren (FE-025). */
  const naarStap = (doel: number) => {
    const nieuw = alsStap(doel);
    setStap(nieuw);
    bewaar.plan({ wizardStap: nieuw });
    void bewaar.nu();
    window.scrollTo({ top: 0 });
  };

  // OFM-047: aanpasmodus zodra de offerte al inhoud heeft (Aanpassen op het detailscherm, of terug van
  // een mislukte Maak opnieuw). Afgeleid uit de offerte zelf, niet uit de navigatie: zo klopt het ook
  // na een herstart of na terugkomen via het Bezig-scherm.
  const aanpassen = detail.inhoud !== null;

  const terug = () => {
    void bewaar.nu();
    gaNaar({ scherm: 'overzicht' });
  };

  /** OFM-047: Terug naar de offerte zonder opnieuw maken; de invoer is bewaard, de inhoud niet veranderd. */
  const terugNaarOfferte = async () => {
    await bewaar.nu();
    gaNaar({ scherm: 'detail', offerteId: detail.id });
  };

  const maak = async (soort: 'maken' | 'zonder_claude' = 'maken') => {
    if (wizardPunten(klantRef.current, invoerRef.current, verplicht, werkLabel, vraagtBedekking).length > 0) {
      setToonFouten(true);
      setToonSamenvatting(true);
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
        {aanpassen ? (
          <TerugKnop opKlik={() => void terugNaarOfferte()} label={t.terugNaarOfferte} />
        ) : (
          <TerugKnop opKlik={terug} />
        )}
        <BewaardIndicator signaal={bewaar.signaal} />
      </div>
      <h1 className="text-3xl font-semibold">{aanpassen ? t.titelAanpassen : t.titel}</h1>
      <Stappenbalk
        stappen={t.stappen}
        huidig={stap}
        opKies={naarStap}
        vrij
        markeringen={stapMarkeringen(punten)}
      />

      {storeFout && (
        <Foutmelding fout={storeFout} opnieuw={() => void maak()} opnieuwInloggen={opnieuwInloggen} />
      )}
      {bewaar.fout !== null && <Foutmelding fout={alsFout(bewaar.fout)} />}

      <section aria-labelledby="wizard-stap-titel" className="flex flex-col gap-6">
        <h2 id="wizard-stap-titel" className="text-2xl font-semibold">
          {stap}. {t.stappen[stap - 1]}
        </h2>
        {stap === 1 && (
          <StapKlant
            klant={klant}
            opWijzig={wijzigKlant}
            toonFouten={toonFouten}
            ontbrekend={ontbrekendInStap1(punten)}
          />
        )}
        {stap === 2 && <StapDak invoer={invoer} opWijzig={wijzigInvoer} keuzelijsten={keuzelijsten} />}
        {stap === 3 && (
          <StapWerkzaamheden
            invoer={invoer}
            opWijzig={wijzigInvoer}
            leesInvoer={() => invoerRef.current}
            keuzelijsten={keuzelijsten}
            set={set}
          />
        )}
        {stap === 4 && (
          <StapOverig
            klant={klant}
            invoer={invoer}
            opWijzigInvoer={wijzigInvoer}
            offertedatum={offertedatum}
            opWijzigDatum={wijzigDatum}
            geldigTot={berekenGeldigTot(offertedatum, geldigheidDagen)}
            keuzes={alsKeuzes(keuzelijsten)}
            catalogus={set}
          />
        )}
      </section>

      {toonSamenvatting && punten.length > 0 && <Samenvatting punten={punten} opNaarStap={naarStap} />}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rand pt-6">
        {stap > 1 ? <Knop label={t.vorige} icoon={ArrowLeft} onClick={() => naarStap(stap - 1)} /> : <span />}
        {stap < 4 ? (
          <Knop label={t.volgende} variant="hoofd" icoon={ArrowRight} onClick={() => naarStap(stap + 1)} />
        ) : aanpassen ? (
          // OFM-047: Maak opnieuw geeft een nieuwe versie (bron `wizard`); Terug laat de inhoud staan.
          <div className="flex flex-wrap items-center justify-end gap-4">
            <Knop label={t.terugNaarOfferte} icoon={ArrowLeft} onClick={() => void terugNaarOfferte()} />
            <Knop
              label={t.maakOpnieuwZonderClaude}
              icoon={FileText}
              onClick={() => void maak('zonder_claude')}
            />
            <Knop label={t.maakOpnieuw} variant="hoofd" icoon={Sparkles} onClick={() => void maak()} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            {/* OFM-039: altijd, als tweede knop naast Maak de offerte (was V-09: alleen na een fout). */}
            <Knop label={t.maakZonderClaude} icoon={FileText} onClick={() => void maak('zonder_claude')} />
            <Knop label={t.maakDeOfferte} variant="hoofd" icoon={Sparkles} onClick={() => void maak()} />
          </div>
        )}
      </div>
    </main>
  );
}
