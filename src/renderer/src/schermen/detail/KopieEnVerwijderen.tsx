import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useMaakKopie, useVerwijderOfferte } from '../../api/offerte';
import { alsFout } from '../../api/roep';
import { Bevestiging } from '../../componenten/Bevestiging';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { useNavigatie } from '../../stores/navigatie';
import { nl } from '../../teksten/nl';

// Maak kopie (FE-061, V-21) en Verwijderen (FE-062) op het detailscherm (OFM-016).

const t = nl.detail;

export function KopieEnVerwijderen({ id }: { id: string }) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const kopie = useMaakKopie(id);
  const verwijder = useVerwijderOfferte(id);
  const [vraag, setVraag] = useState<'kopie' | 'verwijder' | null>(null);

  const maakKopie = (zelfdeKlant: boolean) =>
    kopie.mutate(zelfdeKlant, {
      onSuccess: ({ id: nieuw }) => gaNaar({ scherm: 'wizard', offerteId: nieuw }),
      onSettled: () => setVraag(null),
    });

  return (
    <>
      {kopie.isError && <Foutmelding fout={alsFout(kopie.error)} />}
      {verwijder.isError && <Foutmelding fout={alsFout(verwijder.error)} />}
      <Knop label={t.maakKopie} icoon={Copy} breed onClick={() => setVraag('kopie')} />
      <Knop label={t.verwijderen} icoon={Trash2} breed onClick={() => setVraag('verwijder')} />

      <Bevestiging
        open={vraag === 'kopie'}
        titel={t.kopieTitel}
        bevestigLabel={t.zelfdeKlant}
        annuleerLabel={t.annuleren}
        bevestigUit={kopie.isPending}
        opBevestig={() => maakKopie(true)}
        opAnnuleer={() => setVraag(null)}
      >
        <p>{t.kopieUitleg}</p>
        <Knop label={t.andereKlant} breed disabled={kopie.isPending} onClick={() => maakKopie(false)} />
      </Bevestiging>

      <Bevestiging
        open={vraag === 'verwijder'}
        titel={t.verwijderTitel}
        bevestigLabel={t.jaVerwijderen}
        annuleerLabel={t.nee}
        gevaar
        bevestigUit={verwijder.isPending}
        opBevestig={() =>
          verwijder.mutate(undefined, {
            onSuccess: () => gaNaar({ scherm: 'overzicht' }),
            onSettled: () => setVraag(null),
          })
        }
        opAnnuleer={() => setVraag(null)}
      >
        <p>{t.verwijderUitleg}</p>
      </Bevestiging>
    </>
  );
}
