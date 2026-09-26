import { useCallback, useState } from 'react';
import { FolderOpen, Mail, Printer, Trash2 } from 'lucide-react';
import { useMailOfferte, usePdfActie, useVerwijderOfferte, useZetStatus } from '../api/offerte';
import { alsFout } from '../api/roep';
import { Bevestiging } from '../componenten/Bevestiging';
import { ContextMenu, type MenuRegel, type SluitReden } from '../componenten/ContextMenu';
import { Foutmelding } from '../componenten/Foutmelding';
import type { RijMenu } from '../componenten/OfferteRij';
import { STATUSSEN, statusKiesbaar } from '../componenten/statusKeuze';
import { nl } from '../teksten/nl';

// Contextmenu op een offerte in het overzicht (OFM-052, FO UC-02/03): status, Verstuur per e-mail,
// Toon in map, Afdrukken en Verwijderen, met dezelfde hooks, regels, vragen en meldingen als op het
// detailscherm (OFM-016, OFM-041). Eén exemplaar per geopend menu (de aanroeper geeft een `key`): na
// het sluiten blijft het staan voor de bevestigingen, de e-mailvraag en eventuele foutmeldingen.

const t = nl.overzicht.menu;
const d = nl.detail;

export function OfferteMenu({ menu }: { menu: RijMenu }) {
  const { offerte } = menu;
  const [open, setOpen] = useState(true);
  const [vraag, setVraag] = useState<'verwijder' | 'verstuurd' | null>(null);
  const zet = useZetStatus(offerte.id);
  const mail = useMailOfferte(offerte.id);
  const pdf = usePdfActie(offerte.id);
  const verwijder = useVerwijderOfferte(offerte.id);

  // Een nummer krijgt een offerte pas bij Maak definitief, samen met de PDF (V-01).
  const definitief = offerte.nummer !== null;
  const zonderPdf = definitief ? undefined : t.nietDefinitief;

  const sluit = useCallback(
    (reden: SluitReden) => {
      setOpen(false);
      // Escape, Tab of een keuze: focus terug op de rij (als die er nog is).
      if (reden !== 'buiten' && reden !== 'scroll' && menu.rij.isConnected) menu.rij.focus();
    },
    [menu.rij],
  );

  const verstuur = () =>
    mail.mutate(undefined, {
      // Zoals op Detail (OFM-041): alleen vragen als Verstuurd de logische volgende status is.
      onSuccess: () => setVraag(offerte.status === 'klaar' ? 'verstuurd' : null),
    });

  const regels: MenuRegel[] = [
    {
      soort: 'groep',
      label: t.status,
      keuzes: STATUSSEN.map((s) => ({
        label: nl.componenten.status[s],
        gekozen: s === offerte.status,
        uitReden: statusKiesbaar(s, definitief)
          ? undefined
          : s === 'concept'
            ? t.conceptZelf
            : t.nietDefinitief,
        opKies: () => {
          if (s !== 'concept' && s !== offerte.status) zet.mutate(s);
        },
      })),
    },
    { soort: 'scheiding' },
    { soort: 'actie', label: d.verstuurPerMail, icoon: Mail, uitReden: zonderPdf, opKies: verstuur },
    {
      soort: 'actie',
      label: d.toonInMap,
      icoon: FolderOpen,
      uitReden: zonderPdf,
      opKies: () => pdf.mutate('map'),
    },
    {
      soort: 'actie',
      label: d.afdrukken,
      icoon: Printer,
      uitReden: zonderPdf,
      opKies: () => pdf.mutate('afdrukken'),
    },
    { soort: 'scheiding' },
    {
      soort: 'actie',
      label: d.verwijderen,
      icoon: Trash2,
      gevaar: true,
      opKies: () => setVraag('verwijder'),
    },
  ];

  const fout = [zet, mail, pdf, verwijder].find((m) => m.isError)?.error;

  return (
    <>
      {open && (
        <ContextMenu
          label={t.label(offerte.klantWeergave)}
          positie={menu.positie}
          regels={regels}
          opSluit={sluit}
        />
      )}
      {fout !== undefined && <Foutmelding fout={alsFout(fout)} />}
      {mail.isPending && (
        <p role="status" className="rounded-knop border border-rand bg-vlak p-3">
          {d.mailWordtGeopend}
        </p>
      )}
      {mail.data?.methode === 'mailto' && (
        <p role="status" className="rounded-knop border border-rand bg-vlak p-3">
          {d.mailZonderBijlage}
        </p>
      )}

      <Bevestiging
        open={vraag === 'verstuurd'}
        titel={d.isVerstuurdTitel}
        bevestigLabel={d.ja}
        annuleerLabel={d.nee}
        bevestigUit={zet.isPending}
        opBevestig={() => zet.mutate('verstuurd', { onSettled: () => setVraag(null) })}
        opAnnuleer={() => setVraag(null)}
      >
        <p>{d.isVerstuurdUitleg}</p>
      </Bevestiging>

      <Bevestiging
        open={vraag === 'verwijder'}
        titel={d.verwijderTitel}
        bevestigLabel={d.jaVerwijderen}
        annuleerLabel={d.nee}
        gevaar
        bevestigUit={verwijder.isPending}
        opBevestig={() => verwijder.mutate(undefined, { onSettled: () => setVraag(null) })}
        opAnnuleer={() => setVraag(null)}
      >
        <p>{d.verwijderUitleg}</p>
      </Bevestiging>
    </>
  );
}
