import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Bevestiging } from '../../componenten/Bevestiging';
import { Knop } from '../../componenten/Knop';
import { Veld } from '../../componenten/Veld';
import { startAgentTaak } from '../../stores/agentTaken';
import { useNavigatie, type Bezig } from '../../stores/navigatie';
import { nl } from '../../teksten/nl';

// Laat Claude aanpassen (FO UC-06 stap 4, FE-053, V-07). Het modaal registreert de taak met de
// instructie en gaat naar het Bezig-scherm; dat gaat bij succes of fout terug naar het detailscherm.

const t = nl.detail;
const MAX = 2000;

export function ClaudeAanpassen({ id }: { id: string }) {
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const [open, setOpen] = useState(false);
  const [instructie, setInstructie] = useState('');

  const verstuur = () => {
    const bezig: Bezig = { id, soort: 'aanpassen', terugNaar: 'detail' };
    startAgentTaak(bezig, () => window.api.offertePasAanMetClaude({ id, instructie: instructie.trim() }));
    gaNaar({ scherm: 'bezig', bezig });
  };

  return (
    <>
      <Knop label={t.laatClaudeAanpassen} icoon={Sparkles} breed onClick={() => setOpen(true)} />
      <Bevestiging
        open={open}
        titel={t.aanpassenTitel}
        bevestigLabel={t.aanpassenVersturen}
        annuleerLabel={t.annuleren}
        bevestigUit={instructie.trim() === ''}
        opBevestig={verstuur}
        opAnnuleer={() => setOpen(false)}
      >
        <Veld
          label={t.watMoetErAnders}
          hint={t.watMoetErAndersHint}
          meerdereRegels
          rows={5}
          maxLength={MAX}
          waarde={instructie}
          opWijzig={setInstructie}
        />
      </Bevestiging>
    </>
  );
}
