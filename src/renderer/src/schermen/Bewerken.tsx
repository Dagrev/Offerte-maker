import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { aantalNaarHonderdsten, berekenTotalen, euroNaarCent, regelbedragCent } from '@shared/calc/bedragen';
import { formatEuro } from '@shared/formatteer';
import {
  formulierVan,
  inhoudVan,
  isGewijzigd,
  nieuweRegel,
  verplaats,
  type BewerkFormulier,
} from '@shared/offerteBewerken';
import { btwTariefSchema, eenheidSchema } from '@shared/schemas';
import type { BtwTarief, Eenheid, OfferteInhoud, Offerteregel } from '@shared/types';
import { useBewaarInhoud, useOfferte } from '../api/offerte';
import { alsFout } from '../api/roep';
import { Bevestiging } from '../componenten/Bevestiging';
import { Foutmelding } from '../componenten/Foutmelding';
import { GetalVeld } from '../componenten/GetalVeld';
import { Knop } from '../componenten/Knop';
import { invoerKlassen, Veld, VeldOmlijsting } from '../componenten/Veld';
import { useNavigatie } from '../stores/navigatie';
import { nl } from '../teksten/nl';

// Bewerkscherm (FO UC-06 stap 3; TDO §13.4, V-05, FE-052). Lokale formulierstate met ingevulde tekst;
// totalen rekenen live mee via de shared calc (§7). **Klaar met aanpassen** stuurt de inhoud naar
// `offerte:bewaarInhoud`; main zet hem terug naar plaatshouders en maakt een nieuwe versie.

const t = nl.bewerken;
const EENHEDEN = eenheidSchema.options;
const BTW_TARIEVEN: BtwTarief[] = [21, 9, 0];

export function Bewerken() {
  const offerteId = useNavigatie((s) => s.offerteId);
  const gaNaar = useNavigatie((s) => s.gaNaar);
  // Vers ophalen: het formulier vult zich één keer, dus het moet met de nieuwste inhoud beginnen.
  const query = useOfferte(offerteId, { vers: true });

  if (query.isError) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
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
  const inhoud = query.data.inhoud;
  if (inhoud === null) {
    // Nog niets om aan te passen (bijv. een concept zonder inhoud): terug naar het detailscherm.
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
        <div>
          <Knop label={t.terug} icoon={ArrowLeft} onClick={() => gaNaar({ scherm: 'detail', offerteId })} />
        </div>
      </main>
    );
  }
  return <BewerkFormulierScherm key={offerteId} id={offerteId} oorspronkelijk={inhoud} />;
}

function BewerkFormulierScherm({ id, oorspronkelijk }: { id: string; oorspronkelijk: OfferteInhoud }) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const bewaar = useBewaarInhoud(id);
  const [f, setF] = useState<BewerkFormulier>(() => formulierVan(oorspronkelijk));
  const [vraagAnnuleren, setVraagAnnuleren] = useState(false);

  const nu = inhoudVan(f, oorspronkelijk.regels);
  const totalen = berekenTotalen(nu.regels);
  const gewijzigd = isGewijzigd(f, oorspronkelijk);
  const naarDetail = () => gaNaar({ scherm: 'detail', offerteId: id });

  const zet = <K extends keyof BewerkFormulier>(veld: K, waarde: BewerkFormulier[K]) =>
    setF((oud) => ({ ...oud, [veld]: waarde }));
  const wijzigRegel = (regelId: string, deel: Partial<Offerteregel>) =>
    setF((oud) => ({ ...oud, regels: oud.regels.map((r) => (r.id === regelId ? { ...r, ...deel } : r)) }));

  const klaar = () => {
    if (!gewijzigd) return naarDetail();
    bewaar.mutate(nu, { onSuccess: naarDetail });
  };
  const annuleer = () => (gewijzigd ? setVraagAnnuleren(true) : naarDetail());

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-10 pb-16">
      <h1 className="text-3xl font-semibold">{t.titel}</h1>

      {nu.controlepunten.length > 0 && (
        <section className="flex flex-col gap-3 rounded-knop border-2 border-waarschuwing-rand bg-waarschuwing-vlak p-5">
          <h2 className="text-xl font-semibold text-waarschuwing">{t.controlepunten}</h2>
          <p className="text-waarschuwing">{t.controlepuntenHint}</p>
          <ul className="flex flex-col gap-2">
            {f.controlepunten.map((punt, i) => (
              <li key={`${i}-${punt}`} className="flex items-center gap-3">
                <span className="flex-1">{punt}</span>
                <Knop
                  label={t.controlepuntVerwijderen(i + 1)}
                  icoon={X}
                  alleenIcoon
                  onClick={() =>
                    zet(
                      'controlepunten',
                      f.controlepunten.filter((_, j) => j !== i),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-5">
        <h2 className="text-2xl font-semibold">{t.teksten}</h2>
        <Veld label={t.titelVeld} waarde={f.titel} opWijzig={(w) => zet('titel', w)} />
        <Veld label={t.inleiding} meerdereRegels waarde={f.inleiding} opWijzig={(w) => zet('inleiding', w)} />
        <Veld
          label={t.werkomschrijving}
          hint={t.werkomschrijvingHint}
          meerdereRegels
          rows={6}
          waarde={f.werkomschrijving}
          opWijzig={(w) => zet('werkomschrijving', w)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">{t.regels}</h2>
        {f.regels.length === 0 && <p className="text-tekst-zacht">{t.geenRegels}</p>}
        <ol className="flex flex-col gap-3 overflow-x-auto">
          {f.regels.map((regel, i) => (
            <RegelRij
              key={regel.id}
              regel={regel}
              schatting={nu.regels[i]?.prijsbron === 'schatting'}
              nr={i + 1}
              eerste={i === 0}
              laatste={i === f.regels.length - 1}
              opWijzig={(deel) => wijzigRegel(regel.id, deel)}
              opVerplaats={(richting) => zet('regels', verplaats(f.regels, i, richting))}
              opVerwijder={() =>
                zet(
                  'regels',
                  f.regels.filter((r) => r.id !== regel.id),
                )
              }
            />
          ))}
        </ol>
        <div>
          <Knop
            label={t.regelToevoegen}
            icoon={Plus}
            onClick={() => zet('regels', [...f.regels, nieuweRegel(crypto.randomUUID())])}
          />
        </div>

        <dl className="ml-auto grid w-full max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-2 tabular-nums">
          <dt>{t.subtotaal}</dt>
          <dd className="text-right">{formatEuro(totalen.subtotaalCent)}</dd>
          {totalen.btw.map((b) => (
            <div key={b.tarief} className="contents">
              <dt>{t.btwRegel(b.tarief, formatEuro(b.grondslagCent))}</dt>
              <dd className="text-right">{formatEuro(b.bedragCent)}</dd>
            </div>
          ))}
          <dt className="border-t border-rand pt-2 font-semibold">{t.totaal}</dt>
          <dd className="border-t border-rand pt-2 text-right font-semibold">
            {formatEuro(totalen.totaalCent)}
          </dd>
        </dl>
      </section>

      <section className="flex flex-col gap-5">
        <Veld
          label={t.uitvoering}
          meerdereRegels
          waarde={f.uitvoering}
          opWijzig={(w) => zet('uitvoering', w)}
        />
        <Veld
          label={t.opmerkingen}
          meerdereRegels
          waarde={f.opmerkingen}
          opWijzig={(w) => zet('opmerkingen', w)}
        />
        <Veld
          label={t.afsluiting}
          meerdereRegels
          waarde={f.afsluiting}
          opWijzig={(w) => zet('afsluiting', w)}
        />
      </section>

      {bewaar.isError && <Foutmelding fout={alsFout(bewaar.error)} opnieuw={klaar} />}

      <div className="flex flex-wrap justify-end gap-4">
        <Knop label={t.annuleren} onClick={annuleer} disabled={bewaar.isPending} />
        <Knop
          label={bewaar.isPending ? t.bezigMetBewaren : t.klaar}
          variant="hoofd"
          onClick={klaar}
          disabled={bewaar.isPending}
        />
      </div>

      <Bevestiging
        open={vraagAnnuleren}
        titel={t.annulerenTitel}
        bevestigLabel={t.weggooien}
        annuleerLabel={t.verderAanpassen}
        gevaar
        opBevestig={naarDetail}
        opAnnuleer={() => setVraagAnnuleren(false)}
      >
        <p>{t.annulerenTekst}</p>
      </Bevestiging>
    </main>
  );
}

interface RegelRijProps {
  regel: Offerteregel;
  /** Prijsbron na de wijzigingen tot nu toe: oranje zolang het een schatting is (FE-051). */
  schatting: boolean;
  nr: number;
  eerste: boolean;
  laatste: boolean;
  opWijzig: (deel: Partial<Offerteregel>) => void;
  opVerplaats: (richting: -1 | 1) => void;
  opVerwijder: () => void;
}

/**
 * Eén prijsregel. De labels staan alleen bij de eerste regel zichtbaar (als kolomkoppen); bij de
 * volgende regels zijn ze er alleen voor schermlezers.
 */
function RegelRij({
  regel,
  schatting,
  nr,
  eerste,
  laatste,
  opWijzig,
  opVerplaats,
  opVerwijder,
}: RegelRijProps) {
  // Een leeg getalveld blijft leeg tijdens het typen; voor de berekening telt het als 0.
  const [aantalLeeg, setAantalLeeg] = useState(false);
  const [prijsLeeg, setPrijsLeeg] = useState(false);

  return (
    <li
      className={`grid grid-cols-[minmax(10rem,1fr)_6rem_6.5rem_8rem_6rem_7rem_auto] items-end gap-3 rounded-knop p-3 ${
        schatting ? 'bg-schatting-vlak' : 'bg-vlak'
      } ${eerste ? '' : '[&_label]:sr-only'}`}
    >
      <div className="flex flex-col gap-1">
        <Veld
          label={t.omschrijving}
          waarde={regel.omschrijving}
          opWijzig={(w) => opWijzig({ omschrijving: w })}
        />
        {schatting && <span className="text-sm font-semibold text-waarschuwing">{t.geschat}</span>}
      </div>
      <GetalVeld
        label={t.aantal}
        waarde={aantalLeeg ? null : regel.aantalHonderdsten / 100}
        opWijzig={(w) => {
          setAantalLeeg(w === null);
          opWijzig({ aantalHonderdsten: aantalNaarHonderdsten(w ?? 0) });
        }}
      />
      <Keuze<Eenheid>
        label={t.eenheid}
        waarde={regel.eenheid}
        opties={EENHEDEN.map((e) => ({ waarde: e, label: e }))}
        opWijzig={(eenheid) => opWijzig({ eenheid })}
      />
      <GetalVeld
        label={t.prijs}
        waarde={prijsLeeg ? null : regel.prijsCent / 100}
        opWijzig={(w) => {
          setPrijsLeeg(w === null);
          opWijzig({ prijsCent: euroNaarCent(w ?? 0) });
        }}
      />
      <Keuze<BtwTarief>
        label={t.btw}
        waarde={regel.btwTarief}
        opties={BTW_TARIEVEN.map((b) => ({ waarde: b, label: t.btwOptie(b) }))}
        opWijzig={(btwTarief) => opWijzig({ btwTarief })}
        lees={(w) => btwTariefSchema.parse(Number(w))}
      />
      <div className="flex min-h-14 flex-col justify-end gap-2">
        <span className="font-semibold">{eerste ? t.bedrag : ''}</span>
        <output className="flex min-h-14 items-center justify-end tabular-nums">
          {formatEuro(regelbedragCent(regel))}
        </output>
      </div>
      <div className="flex gap-1">
        <Knop
          label={t.regelOmhoog(nr)}
          icoon={ArrowUp}
          alleenIcoon
          disabled={eerste}
          onClick={() => opVerplaats(-1)}
        />
        <Knop
          label={t.regelOmlaag(nr)}
          icoon={ArrowDown}
          alleenIcoon
          disabled={laatste}
          onClick={() => opVerplaats(1)}
        />
        <Knop
          label={t.regelVerwijderen(nr)}
          icoon={Trash2}
          alleenIcoon
          variant="gevaar"
          onClick={opVerwijder}
        />
      </div>
    </li>
  );
}

interface KeuzeProps<T extends string | number> {
  label: string;
  waarde: T;
  opties: { waarde: T; label: string }[];
  opWijzig: (waarde: T) => void;
  /** Tekst uit het `<select>` terug naar de waarde; standaard de tekst zelf. */
  lees?: (tekst: string) => T;
}

/** Keuzelijst met dezelfde omlijsting als de andere velden. */
function Keuze<T extends string | number>({ label, waarde, opties, opWijzig, lees }: KeuzeProps<T>) {
  return (
    <VeldOmlijsting label={label}>
      {(aria) => (
        <select
          {...aria}
          className={invoerKlassen}
          value={String(waarde)}
          onChange={(e) => opWijzig(lees ? lees(e.target.value) : (e.target.value as T))}
        >
          {opties.map((o) => (
            <option key={String(o.waarde)} value={String(o.waarde)}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </VeldOmlijsting>
  );
}
