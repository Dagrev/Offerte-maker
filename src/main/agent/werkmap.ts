import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { haalGoedgekeurdeVoorbeelden } from '../db/repo/voorbeelden';
import { log } from '../log';
import { paden } from '../paden';

// Agentwerkmap (TDO §10.3, V-16). Alleen geanonimiseerde inhoud; oorspronkelijke bestandsnamen komen
// er nooit in (die kunnen een klantnaam bevatten).

export const CLAUDE_MD_TEKST = 'Deze map bevat geanonimiseerde voorbeeldoffertes. Alleen lezen.';
export const MCP_LEEG = '{"mcpServers":{}}';

export function werkmapBestanden(map: string = paden.agentMap) {
  return {
    map,
    claudeMd: join(map, 'CLAUDE.md'),
    mcpConfig: join(map, 'mcp-leeg.json'),
    systeemprompt: join(map, 'systeemprompt.md'),
    template: join(map, 'template.md'),
    voorbeelden: join(map, 'voorbeelden'),
  };
}

/** Map met de vaste bestanden `CLAUDE.md` en `mcp-leeg.json`. */
export function zorgVoorWerkmap(map: string = paden.agentMap): void {
  const b = werkmapBestanden(map);
  mkdirSync(b.map, { recursive: true });
  writeFileSync(b.claudeMd, CLAUDE_MD_TEKST, 'utf8');
  writeFileSync(b.mcpConfig, MCP_LEEG, 'utf8');
}

/** Bij elke aanroep opnieuw geschreven (§10.3). */
export function schrijfSysteemprompt(tekst: string, map: string = paden.agentMap): string {
  zorgVoorWerkmap(map);
  const pad = werkmapBestanden(map).systeemprompt;
  writeFileSync(pad, tekst, 'utf8');
  return pad;
}

/**
 * API-modus (§10.5, V-17, OFM-020): dezelfde goedgekeurde, geanonimiseerde teksten als de werkmap,
 * maar voor in de opdracht. Voorbeelden nieuwste eerst; de grenzen past `voorbeeldenSectieApi` toe.
 */
export function voorbeeldenVoorApi(): { template: string | null; voorbeelden: string[] } {
  const alle = haalGoedgekeurdeVoorbeelden();
  return {
    template: alle.find((v) => v.isTemplate)?.tekst ?? null,
    voorbeelden: alle
      .filter((v) => !v.isTemplate)
      .reverse()
      .map((v) => v.tekst),
  };
}

/** `voorbeeld-01.md`, `voorbeeld-02.md`, … */
export function voorbeeldBestandsnaam(nummer: number): string {
  return `voorbeeld-${String(nummer).padStart(2, '0')}.md`;
}

/**
 * Maakt `template.md` en `voorbeelden\` volledig opnieuw uit de database: alleen goedgekeurde
 * voorbeelden, oudste eerst (V-16). Aanroepen bij opstart (§14.1 stap 6) en na elke wijziging in
 * voorbeelden (OFM-019) of in `bedrijf` (OFM-018).
 */
export function synchroniseerWerkmap(map: string = paden.agentMap): {
  voorbeelden: number;
  template: boolean;
} {
  const b = werkmapBestanden(map);
  zorgVoorWerkmap(map);
  rmSync(b.template, { force: true });
  rmSync(b.voorbeelden, { recursive: true, force: true });
  mkdirSync(b.voorbeelden);

  const alle = haalGoedgekeurdeVoorbeelden();
  const template = alle.find((v) => v.isTemplate);
  const voorbeelden = alle.filter((v) => !v.isTemplate);

  if (template) writeFileSync(b.template, `# Template\n\n${template.tekst}`, 'utf8');
  voorbeelden.forEach((v, i) => {
    writeFileSync(
      join(b.voorbeelden, voorbeeldBestandsnaam(i + 1)),
      `# Voorbeeldofferte ${i + 1}\n\n${v.tekst}`,
      'utf8',
    );
  });

  log.info(
    `werkmap gesynchroniseerd: ${voorbeelden.length} voorbeelden, template ${template ? 'ja' : 'nee'}`,
  );
  return { voorbeelden: voorbeelden.length, template: Boolean(template) };
}
