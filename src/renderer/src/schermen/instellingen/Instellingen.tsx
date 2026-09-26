import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Instellingen as InstellingenData } from '@shared/types';
import { useInstellingen } from '../../api/instellingen';
import { alsFout } from '../../api/roep';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Knop } from '../../componenten/Knop';
import { useNavigatie, type InstellingenTab } from '../../stores/navigatie';
import { nl } from '../../teksten/nl';
import { Backups } from './Backups';
import { ClaudeKoppeling } from './ClaudeKoppeling';
import { Over } from './Over';
import { Privacylog } from './Privacylog';
import { TabBedrijf } from './TabBedrijf';
import { TabKeuzelijsten } from './TabKeuzelijsten';
import { TabOpmaak } from './TabOpmaak';
import { TabPrijzen } from './TabPrijzen';
import { TabTeksten } from './TabTeksten';
import { TabVoorbeelden } from './TabVoorbeelden';
import { TabWerkzaamheden } from './TabWerkzaamheden';

// Container met álle tabs (FO S5, TDO §13.4, V-03). Eigenaar: OFM-018. Latere tickets vullen alleen
// hun eigen tabbestand; deze container en de tabnamen (`InstellingenTab`) veranderen niet meer
// (uitzonderingen: OFM-034 voegt de tab Keuzelijsten toe, OFM-043 de tab Werkzaamheden).
// Elk tabcomponent krijgt `{ instellingen }` (de uitkomst van `instellingen:haal`) en mag die negeren.

type TabProps = { instellingen: InstellingenData };

const TABS: Record<InstellingenTab, (props: TabProps) => ReactNode> = {
  bedrijf: TabBedrijf,
  opmaak: TabOpmaak,
  teksten: TabTeksten,
  prijzen: TabPrijzen,
  keuzelijsten: TabKeuzelijsten,
  werkzaamheden: TabWerkzaamheden,
  voorbeelden: TabVoorbeelden,
  claudeKoppeling: ClaudeKoppeling,
  privacylog: Privacylog,
  backups: Backups,
  over: Over,
};

const HOOFDTABS: InstellingenTab[] = [
  'bedrijf',
  'opmaak',
  'teksten',
  'prijzen',
  'keuzelijsten',
  'werkzaamheden',
  'voorbeelden',
];
const GEAVANCEERD: InstellingenTab[] = ['claudeKoppeling', 'privacylog', 'backups', 'over'];

const t = nl.instellingen;

export function Instellingen() {
  const gekozen = useNavigatie((s) => s.instellingenTab) ?? 'bedrijf';
  const fout = useNavigatie((s) => s.fout);
  const gaNaar = useNavigatie((s) => s.gaNaar);
  const instellingen = useInstellingen();
  const naarTab = (instellingenTab: InstellingenTab) => gaNaar({ scherm: 'instellingen', instellingenTab });
  const geavanceerd = GEAVANCEERD.includes(gekozen);
  const HuidigeTab = TABS[gekozen];

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-10 py-6">
      <header className="flex items-center gap-6">
        <Knop label={t.terug} icoon={ArrowLeft} onClick={() => gaNaar({ scherm: 'overzicht' })} />
        <h1 className="text-3xl font-semibold">{t.titel}</h1>
      </header>

      <nav aria-label={t.tabs} className="flex flex-wrap gap-2 border-b-2 border-rand pb-3">
        {HOOFDTABS.map((tab) => (
          <TabKnop key={tab} actief={gekozen === tab} opKlik={() => naarTab(tab)}>
            {t.tab[tab]}
          </TabKnop>
        ))}
        <TabKnop actief={geavanceerd} opKlik={() => naarTab(geavanceerd ? gekozen : 'claudeKoppeling')}>
          {t.geavanceerd}
        </TabKnop>
      </nav>
      {geavanceerd && (
        <nav aria-label={t.subtabs} className="flex flex-wrap gap-2">
          {GEAVANCEERD.map((tab) => (
            <TabKnop key={tab} klein actief={gekozen === tab} opKlik={() => naarTab(tab)}>
              {t.tab[tab]}
            </TabKnop>
          ))}
        </nav>
      )}

      {/* Fout uit de navigatie, bijv. na "Standaardteksten uit template" op het Bezig-scherm (V-07). */}
      {fout && <Foutmelding fout={fout} />}

      {instellingen.isError ? (
        <Foutmelding fout={alsFout(instellingen.error)} opnieuw={() => void instellingen.refetch()} />
      ) : !instellingen.data ? (
        <p role="status" className="text-tekst-zacht">
          {nl.algemeen.laden}
        </p>
      ) : (
        <main key={gekozen}>
          <HuidigeTab instellingen={instellingen.data} />
        </main>
      )}
    </div>
  );
}

function TabKnop({
  actief,
  opKlik,
  klein = false,
  children,
}: {
  actief: boolean;
  opKlik: () => void;
  klein?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actief}
      onClick={opKlik}
      className={
        `${klein ? 'min-h-12' : 'min-h-14'} rounded-knop border-2 px-5 font-semibold ` +
        (actief
          ? 'border-accent bg-accent text-white'
          : 'border-rand bg-achtergrond text-tekst hover:border-accent')
      }
    >
      {children}
    </button>
  );
}
