import { FolderOpen } from 'lucide-react';
import { useAppInfo } from '../../api/app';
import { useClaudeStatus } from '../../api/claude';
import { useOpenMap } from '../../api/privacylog';
import { alsFout } from '../../api/roep';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { nl } from '../../teksten/nl';

// Geavanceerd › Over (TDO V-17). Eigenaar: OFM-021.

const t = nl.over;

export function Over() {
  const info = useAppInfo();
  const claude = useClaudeStatus();
  const openMap = useOpenMap();
  const claudeVersie = claude === null ? t.claudeLaden : (claude.versie ?? t.claudeOnbekend);

  const regels: [string, string][] = [
    [t.appVersie, info.data?.versie ?? ''],
    [t.claudeVersie, claudeVersie],
    [t.dataMap, info.data?.dataMap ?? ''],
    [t.documentenMap, info.data?.documentenMap ?? ''],
  ];

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">{t.titel}</h2>
      <Kaart>
        <dl className="grid grid-cols-[16rem_minmax(0,1fr)] gap-x-6 gap-y-4">
          {regels.map(([label, waarde]) => (
            <div key={label} className="contents">
              <dt className="font-semibold">{label}</dt>
              <dd className="break-all">{waarde}</dd>
            </div>
          ))}
        </dl>
      </Kaart>
      {openMap.isError && <Foutmelding fout={alsFout(openMap.error)} />}
      <div className="flex flex-wrap gap-3">
        <Knop label={t.openLogmap} icoon={FolderOpen} onClick={() => openMap.mutate('log')} />
        <Knop label={t.openOffertemap} icoon={FolderOpen} onClick={() => openMap.mutate('offertes')} />
      </div>
    </section>
  );
}
