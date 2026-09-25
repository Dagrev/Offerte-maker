import { spawn } from 'node:child_process';

// Subproces starten zonder shell (TDO §10.4, §17): argumenten als array, uitvoer opvangen tot 5 MB,
// timeout en afbreken via `child.kill()`.

export const MAX_UITVOER_BYTES = 5 * 1024 * 1024;

/** Uitvoerbaar bestand plus vaste argumenten en extra omgeving (nep-CLI: `ELECTRON_RUN_AS_NODE=1`). */
export interface ClaudeCommando {
  command: string;
  prefixArgs: string[];
  env: Record<string, string>;
}

/**
 * `process.env` zonder `ANTHROPIC_API_KEY` en `CLAUDE_CODE_*` (zodat altijd het account wordt gebruikt),
 * aangevuld met `extra`.
 */
export function schoneOmgeving(
  basis: NodeJS.ProcessEnv = process.env,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [sleutel, waarde] of Object.entries(basis)) {
    if (sleutel.toUpperCase() === 'ANTHROPIC_API_KEY' || sleutel.toUpperCase().startsWith('CLAUDE_CODE_'))
      continue;
    env[sleutel] = waarde;
  }
  return { ...env, ...extra };
}

export interface ProcesOpties {
  cwd?: string;
  stdin?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

export interface ProcesUitkomst {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timeout: boolean;
  afgebroken: boolean;
  /** Het bestand kon niet worden gestart (bestaat niet, geen rechten, …). */
  startFout: boolean;
}

class Opvang {
  private delen: Buffer[] = [];
  private grootte = 0;

  voegToe(deel: Buffer): void {
    if (this.grootte >= MAX_UITVOER_BYTES) return;
    const ruimte = MAX_UITVOER_BYTES - this.grootte;
    const stuk = deel.length > ruimte ? deel.subarray(0, ruimte) : deel;
    this.delen.push(stuk);
    this.grootte += stuk.length;
  }

  tekst(): string {
    return Buffer.concat(this.delen).toString('utf8');
  }
}

export function voerProcesUit(
  cmd: ClaudeCommando,
  args: string[],
  opties: ProcesOpties,
): Promise<ProcesUitkomst> {
  return new Promise((klaar) => {
    const stdout = new Opvang();
    const stderr = new Opvang();
    let timeout = false;
    let afgebroken = false;
    let startFout = false;

    if (opties.signal?.aborted) {
      klaar({ exitCode: null, stdout: '', stderr: '', timeout, afgebroken: true, startFout });
      return;
    }

    const child = spawn(cmd.command, [...cmd.prefixArgs, ...args], {
      cwd: opties.cwd,
      env: opties.env ?? schoneOmgeving(process.env, cmd.env),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stop = (): void => {
      if (child.exitCode === null && !child.killed) child.kill();
    };
    const timer = setTimeout(() => {
      timeout = true;
      stop();
    }, opties.timeoutMs);
    const opAfbreken = (): void => {
      afgebroken = true;
      stop();
    };
    opties.signal?.addEventListener('abort', opAfbreken, { once: true });

    child.stdout.on('data', (deel: Buffer) => stdout.voegToe(deel));
    child.stderr.on('data', (deel: Buffer) => stderr.voegToe(deel));
    // Een subproces dat stdin niet leest of vroeg stopt, mag geen EPIPE naar boven gooien.
    child.stdin.on('error', () => undefined);
    child.on('error', () => {
      startFout = true;
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      opties.signal?.removeEventListener('abort', opAfbreken);
      klaar({ exitCode, stdout: stdout.tekst(), stderr: stderr.tekst(), timeout, afgebroken, startFout });
    });

    child.stdin.end(opties.stdin ?? '', 'utf8');
  });
}
