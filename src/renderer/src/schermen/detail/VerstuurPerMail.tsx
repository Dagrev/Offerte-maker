import { Mail } from 'lucide-react';
import { useState } from 'react';
import type { Status } from '@shared/types';
import { useMailOfferte, useZetStatus } from '../../api/offerte';
import { alsFout } from '../../api/roep';
import { Bevestiging } from '../../componenten/Bevestiging';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { nl } from '../../teksten/nl';

// Verstuur per e-mail (OFM-041): opent een concept in het mailprogramma (`offerte:mail`); de app
// verstuurt zelf niets. Daarna de vraag "Is de offerte verstuurd?" — Ja zet de status op Verstuurd.
// Alleen op een definitieve offerte (het detailscherm toont hem alleen met een PDF).

const t = nl.detail;

export function VerstuurPerMail({ id, status }: { id: string; status: Status }) {
  const mail = useMailOfferte(id);
  const zet = useZetStatus(id);
  const [vraag, setVraag] = useState(false);

  const verstuur = () =>
    mail.mutate(undefined, {
      // Alleen vragen als Verstuurd de logische volgende status is (niet bij akkoord of afgewezen).
      onSuccess: () => setVraag(status === 'klaar'),
    });

  return (
    <>
      {mail.isError && <Foutmelding fout={alsFout(mail.error)} opnieuw={verstuur} />}
      <Knop
        label={mail.isPending ? t.mailWordtGeopend : t.verstuurPerMail}
        icoon={Mail}
        breed
        disabled={mail.isPending}
        onClick={verstuur}
      />
      {mail.data?.methode === 'mailto' && (
        <p role="status" className="rounded-knop border border-rand bg-vlak p-3">
          {t.mailZonderBijlage}
        </p>
      )}

      <Bevestiging
        open={vraag}
        titel={t.isVerstuurdTitel}
        bevestigLabel={t.ja}
        annuleerLabel={t.nee}
        bevestigUit={zet.isPending}
        opBevestig={() => zet.mutate('verstuurd', { onSettled: () => setVraag(false) })}
        opAnnuleer={() => setVraag(false)}
      >
        <p>{t.isVerstuurdUitleg}</p>
      </Bevestiging>
      {zet.isError && <Foutmelding fout={alsFout(zet.error)} />}
    </>
  );
}
