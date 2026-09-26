import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { KEUZE_LIJSTEN } from '@shared/keuzelijsten';
import type { KeuzeLijst, Keuzeoptie } from '@shared/types';
import { bewaarKeuzelijst, herstelKeuzelijst, useKeuzelijsten } from '../../api/keuzelijsten';
import { alsFout } from '../../api/roep';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

// Tab Keuzelijsten (OFM-034): per lijst de opties van de wizard, met toevoegen, hernoemen, verbergen,
// verwijderen en de volgorde. Elke wijziging bewaart vanzelf (FE-075); namen na 800 ms of bij verlaten.

const t = nl.keuzelijsten;
const invoerKlasse =
  'min-h-12 w-full rounded-knop border-2 border-rand bg-achtergrond px-3 py-2 aria-[invalid=true]:border-fout';

export function TabKeuzelijsten() {
  const query = useKeuzelijsten();
  const [lijst, setLijst] = useState<KeuzeLijst>('soortWerk');
  // Na "Herstel standaardlijst" de lijst opnieuw uit de database laden.
  const [versie, setVersie] = useState(0);

  if (query.isError) return <Foutmelding fout={alsFout(query.error)} opnieuw={() => void query.refetch()} />;
  if (!query.data) return <p role="status">{nl.algemeen.laden}</p>;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-tekst-zacht">{t.uitleg}</p>
      <nav aria-label={t.kiesLijst} className="flex flex-wrap gap-2">
        {KEUZE_LIJSTEN.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lijst === l}
            onClick={() => setLijst(l)}
            className={
              'min-h-12 rounded-knop border-2 px-4 font-semibold ' +
              (lijst === l
                ? 'border-accent bg-accent text-white'
                : 'border-rand bg-achtergrond text-tekst hover:border-accent')
            }
          >
            {t.lijst[l]}
          </button>
        ))}
      </nav>
      <LijstBewerker
        key={`${lijst}-${versie}`}
        lijst={lijst}
        opties={query.data[lijst]}
        opHersteld={() => setVersie((v) => v + 1)}
      />
    </div>
  );
}

function LijstBewerker({
  lijst,
  opties,
  opHersteld,
}: {
  lijst: KeuzeLijst;
  opties: Keuzeoptie[];
  opHersteld: () => void;
}) {
  const [rijen, setRijen] = useState<Keuzeoptie[]>(opties);
  const [nieuw, setNieuw] = useState('');
  const [teVerwijderen, setTeVerwijderen] = useState<Keuzeoptie | null>(null);
  const [herstellen, setHerstellen] = useState(false);
  const [herstelFout, setHerstelFout] = useState<ReturnType<typeof alsFout> | null>(null);

  const bewaren = useAutoBewaar(
    (waarde: Keuzeoptie[]) =>
      bewaarKeuzelijst(
        lijst,
        waarde.map(({ id, label, verborgen }) => ({ id, label: label.trim(), verborgen })),
      ).then((bewaard) => {
        // Een nieuwe optie heeft nu een id (en een sleutel): neem de bewaarde lijst over.
        if (waarde.some((r) => r.id === '')) setRijen(bewaard);
      }),
    (waarde) => waarde.every((r) => r.label.trim() !== ''),
  );
  const nieuwBezig = rijen.some((r) => r.id === '');

  const wijzig = (nieuweRijen: Keuzeoptie[], direct: boolean) => {
    setRijen(nieuweRijen);
    if (direct) bewaren.bewaarDirect(nieuweRijen);
    else bewaren.wijzig(nieuweRijen);
  };
  const zet = (index: number, deel: Partial<Keuzeoptie>, direct: boolean) =>
    wijzig(
      rijen.map((r, i) => (i === index ? { ...r, ...deel } : r)),
      direct,
    );
  const verplaats = (index: number, richting: -1 | 1) => {
    const doel = index + richting;
    const kopie = [...rijen];
    const [rij] = kopie.splice(index, 1);
    if (!rij) return;
    kopie.splice(doel, 0, rij);
    wijzig(kopie, true);
  };
  const voegToe = () => {
    const label = nieuw.trim();
    if (label === '' || nieuwBezig) return;
    const optie: Keuzeoptie = {
      id: '',
      sleutel: 'nieuw',
      label,
      verborgen: false,
      standaard: false,
      vast: false,
      inGebruik: false,
    };
    setNieuw('');
    wijzig([...rijen, optie], true);
  };
  const verwijder = (optie: Keuzeoptie) =>
    wijzig(
      rijen.filter((r) => r !== optie),
      true,
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{t.lijst[lijst]}</h2>
        <BewaardIndicator signaal={bewaren.signaal} />
      </div>
      {lijst in t.lijstHint && (
        <p className="text-tekst-zacht">{t.lijstHint[lijst as keyof typeof t.lijstHint]}</p>
      )}
      {bewaren.fout && <Foutmelding fout={bewaren.fout} />}
      {herstelFout && <Foutmelding fout={herstelFout} />}

      <ul aria-label={t.lijst[lijst]} className="flex flex-col">
        {rijen.map((optie, index) => {
          const naam = optie.label.trim() || t.naam;
          return (
            <li
              key={optie.id || `nieuw-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-rand px-2 py-2"
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className={`${invoerKlasse} max-w-xl ${optie.verborgen ? 'text-tekst-zacht' : ''}`}
                  aria-label={t.naamVan(naam)}
                  aria-invalid={optie.label.trim() === '' || undefined}
                  title={optie.label.trim() === '' ? t.naamFout : undefined}
                  value={optie.label}
                  maxLength={80}
                  onChange={(e) => zet(index, { label: e.target.value }, false)}
                  onBlur={bewaren.bewaarNu}
                />
                {optie.verborgen && (
                  <span className="rounded-full bg-vlak px-3 py-1 text-tekst-zacht">{t.verborgen}</span>
                )}
                {optie.vast && (
                  <span className="rounded-full bg-vlak px-3 py-1 text-tekst-zacht" title={t.vastUitleg}>
                    {t.vast}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Knop
                  label={t.omhoog(naam)}
                  icoon={ArrowUp}
                  alleenIcoon
                  disabled={index === 0}
                  onClick={() => verplaats(index, -1)}
                />
                <Knop
                  label={t.omlaag(naam)}
                  icoon={ArrowDown}
                  alleenIcoon
                  disabled={index === rijen.length - 1}
                  onClick={() => verplaats(index, 1)}
                />
                {!optie.vast && (
                  <>
                    <Knop
                      label={optie.verborgen ? t.toon(naam) : t.verberg(naam)}
                      icoon={optie.verborgen ? Eye : EyeOff}
                      alleenIcoon
                      disabled={optie.id === ''}
                      onClick={() => zet(index, { verborgen: !optie.verborgen }, true)}
                    />
                    <Knop
                      label={t.verwijder(naam)}
                      icoon={Trash2}
                      alleenIcoon
                      disabled={optie.id === ''}
                      onClick={() => setTeVerwijderen(optie)}
                    />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          voegToe();
        }}
      >
        <div className="min-w-72 flex-1">
          <Veld label={t.nieuw} hint={t.nieuwHint} waarde={nieuw} opWijzig={setNieuw} />
        </div>
        <Knop type="submit" label={t.toevoegen} icoon={Plus} disabled={nieuw.trim() === '' || nieuwBezig} />
      </form>

      <div>
        <Knop label={t.herstel} icoon={RotateCcw} variant="secundair" onClick={() => setHerstellen(true)} />
      </div>

      <Bevestiging
        open={teVerwijderen !== null && !teVerwijderen.inGebruik}
        titel={t.verwijderTitel}
        bevestigLabel={t.verwijderJa}
        annuleerLabel={t.verwijderNee}
        gevaar
        opAnnuleer={() => setTeVerwijderen(null)}
        opBevestig={() => {
          const optie = teVerwijderen;
          setTeVerwijderen(null);
          if (optie) verwijder(optie);
        }}
      >
        <p>{teVerwijderen && t.verwijderTekst(teVerwijderen.label)}</p>
      </Bevestiging>

      <Bevestiging
        open={teVerwijderen !== null && teVerwijderen.inGebruik}
        titel={t.verwijderTitel}
        bevestigLabel={t.verbergInPlaats}
        annuleerLabel={t.sluiten}
        opAnnuleer={() => setTeVerwijderen(null)}
        opBevestig={() => {
          const optie = teVerwijderen;
          setTeVerwijderen(null);
          const index = rijen.findIndex((r) => r === optie);
          if (index >= 0) zet(index, { verborgen: true }, true);
        }}
      >
        <p>{teVerwijderen && t.inGebruik(teVerwijderen.label)}</p>
      </Bevestiging>

      <Bevestiging
        open={herstellen}
        titel={t.herstelTitel}
        bevestigLabel={t.herstelJa}
        annuleerLabel={t.herstelNee}
        opAnnuleer={() => setHerstellen(false)}
        opBevestig={() => {
          setHerstellen(false);
          // Eerst een wachtende naamwijziging wegschrijven, dan herstellen en opnieuw laden.
          bewaren.bewaarNu();
          herstelKeuzelijst(lijst).then(opHersteld, (e: unknown) => setHerstelFout(alsFout(e)));
        }}
      >
        <p>{t.herstelTekst}</p>
      </Bevestiging>
    </div>
  );
}
