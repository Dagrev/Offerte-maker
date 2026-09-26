import { describe, expect, it, vi } from 'vitest';
import { AppFout } from '@shared/fouten';
import { MAX_MAILTO_LENGTE, mailtoUrl, openViaMailto, type MailShell } from './mailto';

const concept = {
  aan: 'jan@voorbeeld.nl',
  onderwerp: 'Offerte 1 van A & B',
  tekst: 'Geachte heer,\r\n\r\n€ 5?',
};

function nepShell(openExternal: MailShell['openExternal'] = () => Promise.resolve()) {
  return { openExternal: vi.fn(openExternal), showItemInFolder: vi.fn() };
}

describe('mailto (OFM-041)', () => {
  it('codeert aan, onderwerp en tekst', () => {
    expect(mailtoUrl(concept)).toBe(
      'mailto:jan%40voorbeeld.nl?subject=Offerte%201%20van%20A%20%26%20B&body=Geachte%20heer%2C%0D%0A%0D%0A%E2%82%AC%205%3F',
    );
    expect(mailtoUrl({ ...concept, aan: '' }).startsWith('mailto:?subject=')).toBe(true);
  });

  it('kort een te lange tekst in tot de URL past, zonder half teken', () => {
    const url = mailtoUrl({ ...concept, tekst: '😀é'.repeat(2000) });
    expect(url.length).toBeLessThanOrEqual(MAX_MAILTO_LENGTE);
    expect(url.length).toBeGreaterThan(MAX_MAILTO_LENGTE - 20);
    expect(url).toContain('&body=%F0%9F%98%80');
    expect(() => decodeURIComponent(url)).not.toThrow();
    // Een onderwerp dat alleen al te lang is: lege tekst, verder niets aan te doen.
    expect(mailtoUrl({ ...concept, onderwerp: 'x'.repeat(3000) }).endsWith('&body=')).toBe(true);
  });

  it('opent de mailto en toont de PDF in Verkenner', async () => {
    const shell = nepShell();
    await openViaMailto(concept, 'C:\\pdf\\a.pdf', shell);
    expect(shell.openExternal).toHaveBeenCalledWith(mailtoUrl(concept));
    expect(shell.showItemInFolder).toHaveBeenCalledWith('C:\\pdf\\a.pdf');
  });

  it('lukt openen niet: MAIL_GEEN_PROGRAMMA en geen Verkenner', async () => {
    const shell = nepShell(() => Promise.reject(new Error('geen handler')));
    const fout = await openViaMailto(concept, 'a.pdf', shell).catch((e: unknown) => e);
    expect(fout).toBeInstanceOf(AppFout);
    expect((fout as AppFout).code).toBe('MAIL_GEEN_PROGRAMMA');
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });
});
