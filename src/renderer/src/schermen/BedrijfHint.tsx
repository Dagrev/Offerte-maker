import { Settings, X } from 'lucide-react';
import { useInstellingen } from '../api/instellingen';
import { GeleBalk } from '../componenten/GeleBalk';
import { Knop } from '../componenten/Knop';
import { useBedrijfHint } from '../stores/bedrijfHint';
import { useNavigatie } from '../stores/navigatie';
import { nl } from '../teksten/nl';

const t = nl.overzicht.bedrijfHint;

/**
 * Hint op het hoofdscherm zolang de bedrijfsnaam leeg is (OFM-029): het welkomstscherm heeft geen
 * verplichte velden meer (V-20). **Verberg** geldt voor deze start (zie `stores/bedrijfHint.ts`).
 */
export function BedrijfHint() {
  const instellingen = useInstellingen();
  const verborgen = useBedrijfHint((s) => s.verborgen);
  const verberg = useBedrijfHint((s) => s.verberg);
  const gaNaar = useNavigatie((s) => s.gaNaar);

  if (verborgen || !instellingen.data || instellingen.data.bedrijf.naam.trim() !== '') return null;
  return (
    <GeleBalk titel={t.titel}>
      <p>{t.tekst}</p>
      <div className="flex flex-wrap gap-3">
        <Knop
          label={t.naarInstellingen}
          icoon={Settings}
          onClick={() => gaNaar({ scherm: 'instellingen', instellingenTab: 'bedrijf' })}
        />
        <Knop label={t.verberg} icoon={X} onClick={verberg} />
      </div>
    </GeleBalk>
  );
}
