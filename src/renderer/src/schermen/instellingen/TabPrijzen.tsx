import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { euroNaarCent } from '@shared/calc/bedragen';
import type { Fout } from '@shared/fouten';
import type { Eenheid, Prijspost } from '@shared/types';
import { bewaarPrijspost, usePrijzen, verwijderPrijspost } from '../../api/prijzen';
import { alsFout } from '../../api/roep';
import { Bevestiging } from '../../componenten/Bevestiging';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { useSelecteerBijFocus } from '../../componenten/GetalVeld';
import { Knop } from '../../componenten/Knop';
import { leesGetal, schoonGetalInvoer, toonGetal } from '../../componenten/getalNotatie';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

const t = nl.instellingen.prijzen;
const EENHEDEN: Eenheid[] = ['m²', 'm¹', 'stuk', 'post', 'uur', 'dag'];
const TARIEVEN: Prijspost['btwTarief'][] = [21, 9, 0];
const KOLOMMEN = 'grid grid-cols-[minmax(0,1fr)_8rem_11rem_7rem_3.5rem] items-center gap-3';
const invoer =
  'min-h-12 w-full rounded-knop border-2 border-rand bg-achtergrond px-3 py-2 aria-[invalid=true]:border-fout';

/** Tab Prijzen (FE-074): de prijslijst als tabel; elke rij bewaart vanzelf (FE-075). */
export function TabPrijzen() {
  const prijzen = usePrijzen();
  const [signaal, setSignaal] = useState(0);
  const [fout, setFout] = useState<Fout | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<Prijspost | null>(null);
  const opBewaard = () => {
    setFout(null);
    setSignaal((s) => s + 1);
  };

  const voegToe = () =>
    bewaarPrijspost({
      id: '',
      sleutel: null,
      omschrijving: t.nieuwePost,
      eenheid: 'stuk',
      prijsCent: null,
      btwTarief: 21,
      volgorde: 0,
    }).then(opBewaard, (e: unknown) => setFout(alsFout(e)));

  if (prijzen.isError)
    return <Foutmelding fout={alsFout(prijzen.error)} opnieuw={() => void prijzen.refetch()} />;
  if (!prijzen.data) return <p role="status">{nl.algemeen.laden}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-tekst-zacht">{t.uitleg}</p>
        <BewaardIndicator signaal={signaal} />
      </div>
      {fout && <Foutmelding fout={fout} />}

      <div role="table" aria-label={nl.instellingen.tab.prijzen} className="flex flex-col">
        <div role="row" className={`${KOLOMMEN} border-b-2 border-rand px-2 pb-2 font-semibold`}>
          <span role="columnheader">{t.omschrijving}</span>
          <span role="columnheader">{t.eenheid}</span>
          <span role="columnheader" className="text-right">
            {t.prijs}
          </span>
          <span role="columnheader">{t.btw}</span>
          <span role="columnheader" />
        </div>
        {prijzen.data.map((post) => (
          <PrijsRij
            key={post.id}
            post={post}
            opBewaard={opBewaard}
            opFout={setFout}
            opVerwijder={() => setTeVerwijderen(post)}
          />
        ))}
      </div>

      <div>
        <Knop label={t.toevoegen} icoon={Plus} onClick={() => void voegToe()} />
      </div>

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t.verwijderTitel}
        bevestigLabel={t.verwijderJa}
        annuleerLabel={t.verwijderNee}
        gevaar
        opAnnuleer={() => setTeVerwijderen(null)}
        opBevestig={() => {
          const post = teVerwijderen;
          setTeVerwijderen(null);
          if (post) verwijderPrijspost(post.id).catch((e: unknown) => setFout(alsFout(e)));
        }}
      >
        <p>{teVerwijderen && t.verwijderTekst(teVerwijderen.omschrijving)}</p>
      </Bevestiging>
    </div>
  );
}

function PrijsRij({
  post,
  opBewaard,
  opFout,
  opVerwijder,
}: {
  post: Prijspost;
  opBewaard: () => void;
  opFout: (fout: Fout) => void;
  opVerwijder: () => void;
}) {
  const [rij, setRij] = useState(post);
  const [prijsTekst, setPrijsTekst] = useState(
    toonGetal(post.prijsCent === null ? null : post.prijsCent / 100, 2),
  );
  const bewaren = useAutoBewaar(
    (waarde: Prijspost) => bewaarPrijspost(waarde).then(opBewaard, (e: unknown) => opFout(alsFout(e))),
    (waarde) => waarde.omschrijving.trim() !== '',
  );
  const selecteer = useSelecteerBijFocus();
  const naam = rij.omschrijving.trim() || t.nieuwePost;

  const wijzig = (deel: Partial<Prijspost>, direct = false) => {
    const nieuw = { ...rij, ...deel };
    setRij(nieuw);
    if (direct) bewaren.bewaarDirect(nieuw);
    else bewaren.wijzig(nieuw);
  };

  return (
    <div role="row" className={`${KOLOMMEN} border-b border-rand px-2 py-2`}>
      <span role="cell">
        <input
          className={invoer}
          aria-label={t.rijLabel(naam, t.omschrijving)}
          aria-invalid={rij.omschrijving.trim() === '' || undefined}
          title={rij.omschrijving.trim() === '' ? t.omschrijvingFout : undefined}
          value={rij.omschrijving}
          onChange={(e) => wijzig({ omschrijving: e.target.value })}
          onBlur={bewaren.bewaarNu}
        />
      </span>
      <span role="cell">
        <select
          className={invoer}
          aria-label={t.rijLabel(naam, t.eenheid)}
          value={rij.eenheid}
          onChange={(e) => wijzig({ eenheid: e.target.value as Eenheid }, true)}
        >
          {EENHEDEN.map((e) => (
            <option key={e} value={e}>
              {t.eenheden[e]}
            </option>
          ))}
        </select>
      </span>
      <span role="cell" className="flex items-center gap-2">
        <span aria-hidden="true" className="text-tekst-zacht">
          €
        </span>
        <input
          className={`${invoer} text-right tabular-nums`}
          aria-label={t.rijLabel(naam, t.prijs)}
          inputMode="decimal"
          onFocus={selecteer.onFocus}
          onMouseUp={selecteer.onMouseUp}
          onKeyDown={selecteer.onKeyDown}
          autoComplete="off"
          value={prijsTekst}
          onChange={(e) => {
            const schoon = schoonGetalInvoer(e.target.value, 2);
            setPrijsTekst(schoon);
            const euro = leesGetal(schoon);
            wijzig({ prijsCent: euro === null ? null : euroNaarCent(euro) });
          }}
          onBlur={() => {
            setPrijsTekst(toonGetal(leesGetal(prijsTekst), 2));
            bewaren.bewaarNu();
          }}
        />
      </span>
      <span role="cell">
        <select
          className={invoer}
          aria-label={t.rijLabel(naam, t.btw)}
          value={rij.btwTarief}
          onChange={(e) => wijzig({ btwTarief: Number(e.target.value) as Prijspost['btwTarief'] }, true)}
        >
          {TARIEVEN.map((tarief) => (
            <option key={tarief} value={tarief}>
              {t.btwTarief(tarief)}
            </option>
          ))}
        </select>
      </span>
      <span role="cell">
        <Knop label={t.verwijder(naam)} alleenIcoon icoon={Trash2} onClick={opVerwijder} />
      </span>
    </div>
  );
}
