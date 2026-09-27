import { useEffect, useRef, useState, type ReactNode } from 'react';

// Balk die bovenaan in beeld blijft als de pagina scrolt (OFM-060): de tabbalk van Instellingen en de
// stappenbalk van wizard en welkomstscherm. `position: sticky` binnen het document (dat scrolt zelf, er
// is geen eigen scrollcontainer). Zodra de balk vastzit, krijgt hij een schaduw aan de onderkant. Zijn
// hoogte staat in `--vaste-balk-hoogte` op `<html>`; `scroll-padding-top` in `styles/app.css` gebruikt die,
// zodat een veld dat met Tab in beeld scrolt nooit achter de balk verdwijnt.

/** CSS-variabele met de hoogte van de vaste balk in pixels. */
export const VASTE_BALK_VAR = '--vaste-balk-hoogte';

export function VasteBalk({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vast, setVast] = useState(false);

  // Vast = de pagina is gescrold en de balk staat tegen de bovenrand.
  useEffect(() => {
    const balk = ref.current;
    if (!balk) return;
    const meet = () => setVast(window.scrollY > 0 && balk.getBoundingClientRect().top <= 1);
    window.addEventListener('scroll', meet, { passive: true });
    window.addEventListener('resize', meet);
    return () => {
      window.removeEventListener('scroll', meet);
      window.removeEventListener('resize', meet);
    };
  }, []);

  // Hoogte bijhouden (de tabbalk kan op twee regels staan, de geavanceerde tabs komen erbij).
  useEffect(() => {
    const balk = ref.current;
    if (!balk) return;
    const wortel = document.documentElement;
    const zet = () => wortel.style.setProperty(VASTE_BALK_VAR, `${balk.offsetHeight}px`);
    zet();
    const waarnemer = new ResizeObserver(zet);
    waarnemer.observe(balk);
    return () => {
      waarnemer.disconnect();
      wortel.style.removeProperty(VASTE_BALK_VAR);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-vast={vast || undefined}
      className={`sticky top-0 z-30 flex flex-col gap-2 bg-achtergrond py-2 transition-shadow ${
        // Onderrand (1 px in de randkleur) plus een zachte schaduw; als schaduw, zodat de hoogte gelijk blijft.
        vast ? 'shadow-[0_1px_0_var(--color-rand),0_8px_8px_-8px_rgba(0,0,0,0.25)]' : ''
      }`}
    >
      {children}
    </div>
  );
}
