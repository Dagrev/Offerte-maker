import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import log from 'electron-log/renderer';
import { useAppInfo } from './api/app';
import { alsFout } from './api/roep';
import { Foutmelding } from './componenten/Foutmelding';
import { Knop } from './componenten/Knop';
import { useNavigatie, type Scherm } from './stores/navigatie';
import { nl } from './teksten/nl';
import { Bewerken } from './schermen/Bewerken';
import { Bezig } from './schermen/Bezig';
import { Detail } from './schermen/Detail';
import { Instellingen } from './schermen/instellingen/Instellingen';
import { Overzicht } from './schermen/Overzicht';
import { Prullenbak } from './schermen/Prullenbak';
import { Welkom } from './schermen/Welkom';
import { Wizard } from './schermen/wizard/Wizard';

// Kiest het scherm op basis van de navigatie-store (TDO §13.1, V-03). Geen router. Latere tickets
// wijzigen dit bestand niet: ze vervangen alleen de placeholder in hun eigen schermbestand.

const schermen: Record<Scherm, () => ReactNode> = {
  welkom: Welkom,
  overzicht: Overzicht,
  wizard: Wizard,
  bezig: Bezig,
  detail: Detail,
  bewerken: Bewerken,
  instellingen: Instellingen,
  prullenbak: Prullenbak,
};

export function App() {
  const info = useAppInfo();
  const gestart = useNavigatie((s) => s.gestart);
  const start = useNavigatie((s) => s.start);
  const scherm = useNavigatie((s) => s.scherm);

  // Beginscherm (V-27) en "vandaag" (V-10) komen uit `app:info`, eenmalig per sessie.
  useEffect(() => {
    if (info.data && !gestart) start(info.data);
  }, [info.data, gestart, start]);

  if (info.isError) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
        <h1 className="text-3xl font-semibold">{nl.algemeen.startMislukt}</h1>
        <Foutmelding fout={alsFout(info.error)} opnieuw={() => void info.refetch()} />
      </main>
    );
  }
  if (!gestart) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-tekst-zacht">
          {nl.algemeen.laden}
        </p>
      </main>
    );
  }

  const HuidigScherm = schermen[scherm];
  return (
    <Vangnet key={scherm}>
      <HuidigScherm />
    </Vangnet>
  );
}

/** Vangt renderfouten van een scherm op, logt ze (§15.3) en toont een herstelknop. */
class Vangnet extends Component<{ children: ReactNode }, { fout: boolean }> {
  override state = { fout: false };

  static getDerivedStateFromError() {
    return { fout: true };
  }

  override componentDidCatch(fout: Error, info: ErrorInfo) {
    log.error('Renderfout in scherm', fout, info.componentStack);
  }

  override render() {
    if (!this.state.fout) return this.props.children;
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
        <Foutmelding fout={alsFout(null)} />
        <div>
          <Knop
            label={nl.algemeen.herstart}
            variant="hoofd"
            onClick={() => useNavigatie.getState().gaNaar({ scherm: 'overzicht' })}
          />
        </div>
      </main>
    );
  }
}
