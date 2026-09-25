import { useState } from 'react';
import { CheckCircle2, FolderOpen, Gauge, KeyRound, LogIn, PlayCircle, Trash2, XCircle } from 'lucide-react';
import type { Fout } from '@shared/fouten';
import { FOUTMELDINGEN } from '@shared/teksten/fouten';
import type { ClaudeInstelling, ClaudeStatus, Instellingen } from '@shared/types';
import {
  bewaarApiSleutel,
  kiesClaudePad,
  koppelClaude,
  testKoppeling,
  useClaudeStatusQuery,
} from '../../api/claude';
import { bewaarInstelling } from '../../api/instellingen';
import { queryClient } from '../../api/queryClient';
import { queryKeys } from '../../api/queryKeys';
import { alsFout } from '../../api/roep';
import { BewaardIndicator } from '../../componenten/BewaardIndicator';
import { Foutmelding } from '../../componenten/Foutmelding';
import { Kaart } from '../../componenten/Kaart';
import { Knop } from '../../componenten/Knop';
import { TegelKeuze } from '../../componenten/TegelKeuze';
import { Veld } from '../../componenten/Veld';
import { nl } from '../../teksten/nl';
import { useAutoBewaar } from './autoBewaar';

const t = nl.claudeKoppeling;

type Effort = ClaudeInstelling['effort'];
interface ClaudeVelden {
  pad: string;
  model: string;
  effort: Effort;
}

const EFFORT_OPTIES = (['low', 'medium', 'high'] as const).map((waarde) => ({
  waarde,
  label: t.effortOpties[waarde],
  icoon: Gauge,
}));

const padGeldig = (pad: string) => pad.trim() === '' || /\.exe$/i.test(pad.trim());
const geldig = (v: ClaudeVelden) => v.model.trim() !== '' && padGeldig(v.pad);

async function bewaarClaude(v: ClaudeVelden): Promise<void> {
  const pad = v.pad.trim();
  await bewaarInstelling({
    sleutel: 'claude',
    waarde: { pad: pad === '' ? null : pad, model: v.model.trim(), effort: v.effort },
  });
  // Main leegt de statuscache bij het bewaren van `claude` (V-17); hier de status opnieuw ophalen.
  await queryClient.invalidateQueries({ queryKey: queryKeys.claudeStatus() });
}

/** Instellingen → Geavanceerd → Claude-koppeling (FO UC-14, V-17). */
export function ClaudeKoppeling({ instellingen }: { instellingen: Instellingen }) {
  const [velden, setVelden] = useState<ClaudeVelden>({
    pad: instellingen.claude.pad ?? '',
    model: instellingen.claude.model,
    effort: instellingen.claude.effort,
  });
  const bewaren = useAutoBewaar(bewaarClaude, geldig);

  const wijzig = (deel: Partial<ClaudeVelden>) => {
    const nieuw = { ...velden, ...deel };
    setVelden(nieuw);
    bewaren.wijzig(nieuw);
  };
  const wijzigDirect = (deel: Partial<ClaudeVelden>) => {
    const nieuw = { ...velden, ...deel };
    setVelden(nieuw);
    bewaren.bewaarDirect(nieuw);
  };

  const bladeren = async () => {
    try {
      const pad = await kiesClaudePad();
      if (pad) wijzigDirect({ pad });
    } catch {
      // Dialoog mislukt: niets veranderen.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-tekst-zacht">{t.uitleg}</p>
        <BewaardIndicator signaal={bewaren.signaal} />
      </div>
      <StatusBlok />

      <Kaart titel={t.instellingenTitel}>
        {bewaren.fout && <Foutmelding fout={bewaren.fout} opnieuw={bewaren.bewaarNu} />}
        <div className="max-w-md">
          <Veld
            label={t.model}
            hint={t.modelHint}
            waarde={velden.model}
            fout={velden.model.trim() === '' ? t.modelLeeg : undefined}
            opWijzig={(model) => wijzig({ model })}
            onBlur={bewaren.bewaarNu}
            autoComplete="off"
          />
        </div>
        <TegelKeuze
          label={t.effort}
          opties={EFFORT_OPTIES}
          waarde={velden.effort}
          opKies={(effort) => wijzigDirect({ effort })}
        />
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-80 flex-1">
            <Veld
              label={t.pad}
              hint={t.padHint}
              waarde={velden.pad}
              fout={padGeldig(velden.pad) ? undefined : t.padFout}
              opWijzig={(pad) => wijzig({ pad })}
              onBlur={bewaren.bewaarNu}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="pb-9">
            <Knop label={t.bladeren} icoon={FolderOpen} onClick={() => void bladeren()} />
          </div>
        </div>
      </Kaart>

      <ApiSleutel ingevuld={instellingen.claude.apiSleutelIngevuld} />
    </div>
  );
}

function statusTekst(status: ClaudeStatus): string {
  if (status.toestand === 'fout') return FOUTMELDINGEN[status.code];
  return status.via === 'api-sleutel' ? t.gekoppeldApi : t.gekoppeldAccount(status.versie);
}

function StatusBlok() {
  const status = useClaudeStatusQuery();
  const [bezig, setBezig] = useState<'koppel' | 'test' | null>(null);
  const [fout, setFout] = useState<Fout | null>(null);
  const [werkt, setWerkt] = useState(false);

  const voerUit = async (soort: 'koppel' | 'test') => {
    setBezig(soort);
    setFout(null);
    setWerkt(false);
    try {
      if (soort === 'koppel') await koppelClaude();
      else {
        await testKoppeling();
        setWerkt(true);
      }
    } catch (e) {
      setFout(alsFout(e));
    } finally {
      setBezig(null);
    }
  };

  const data = status.data;
  const gekoppeld = data?.toestand === 'gekoppeld';

  return (
    <Kaart titel={t.statusTitel}>
      {status.isError ? (
        <Foutmelding fout={alsFout(status.error)} opnieuw={() => void status.refetch()} />
      ) : !data || status.isFetching ? (
        <p role="status" className="text-tekst-zacht">
          {t.statusLaden}
        </p>
      ) : (
        <p
          role="status"
          className={`flex items-start gap-3 text-lg font-semibold ${gekoppeld ? 'text-goed' : 'text-fout'}`}
        >
          {gekoppeld ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-7 shrink-0" />
          ) : (
            <XCircle aria-hidden="true" className="mt-0.5 size-7 shrink-0" />
          )}
          <span>{statusTekst(data)}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Knop
          label={t.koppel}
          icoon={LogIn}
          variant={gekoppeld ? 'secundair' : 'hoofd'}
          disabled={bezig !== null}
          onClick={() => void voerUit('koppel')}
        />
        <Knop
          label={t.test}
          icoon={PlayCircle}
          disabled={bezig !== null}
          onClick={() => void voerUit('test')}
        />
      </div>
      {bezig && (
        <p role="status" className="rounded-knop bg-vlak px-5 py-4">
          {bezig === 'koppel' ? t.koppelBezig : t.testBezig}
        </p>
      )}
      {werkt && (
        <p role="status" className="flex items-center gap-2 text-lg font-semibold text-goed">
          <CheckCircle2 aria-hidden="true" className="size-6" />
          {t.werkt}
        </p>
      )}
      {fout && <Foutmelding fout={fout} />}
    </Kaart>
  );
}

function ApiSleutel({ ingevuld: beginIngevuld }: { ingevuld: boolean }) {
  const [ingevuld, setIngevuld] = useState(beginIngevuld);
  const [sleutel, setSleutel] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<Fout | null>(null);
  const [signaal, setSignaal] = useState(0);

  const bewaar = async (waarde: string | null) => {
    setBezig(true);
    setFout(null);
    try {
      await bewaarApiSleutel(waarde);
      setIngevuld(waarde !== null);
      setSleutel('');
      setSignaal((s) => s + 1);
    } catch (e) {
      setFout(alsFout(e));
    } finally {
      setBezig(false);
    }
  };

  return (
    <Kaart titel={t.sleutelTitel}>
      <p className="max-w-3xl text-tekst-zacht">{t.sleutelUitleg}</p>
      {fout && <Foutmelding fout={fout} />}
      {ingevuld ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="flex items-center gap-2 font-semibold">
            <KeyRound aria-hidden="true" className="size-6 text-accent" />
            {t.sleutelIngevuld}
          </p>
          <Knop
            label={t.verwijderen}
            icoon={Trash2}
            variant="gevaar"
            disabled={bezig}
            onClick={() => void bewaar(null)}
          />
          <BewaardIndicator signaal={signaal} />
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-80 flex-1">
            <Veld
              label={t.sleutel}
              type="password"
              autoComplete="off"
              spellCheck={false}
              waarde={sleutel}
              opWijzig={setSleutel}
            />
          </div>
          <Knop
            label={t.bewaren}
            icoon={KeyRound}
            disabled={bezig || sleutel.trim() === ''}
            onClick={() => void bewaar(sleutel.trim())}
          />
          <BewaardIndicator signaal={signaal} />
        </div>
      )}
    </Kaart>
  );
}
