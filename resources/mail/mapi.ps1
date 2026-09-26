# Offerte maker - Verstuur per e-mail (OFM-041).
# Opent via Simple MAPI (MAPISendMail met MAPI_DIALOG) een NIET verzonden concept in het standaard
# mailprogramma, met de PDF als bijlage. Dit script verstuurt zelf nooit iets.
#
# Invoer (stdin, JSON, UTF-8): { "aan": "", "onderwerp": "", "tekst": "", "pad": "C:\...\offerte.pdf" }
# Uitvoer (stdout, een regel JSON): { "mapi": <returncode of null>, "mailto": <true|false> }
#   mapi 0 = verzonden, 1 = gesloten zonder verzenden (MAPI_USER_ABORT), overige = fout;
#   null = MAPI niet aan te roepen (DLL of functie ontbreekt).
#   mailto = of Windows een standaardprogramma voor mailto: kent.

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

$invoer = [Console]::In.ReadToEnd() | ConvertFrom-Json

function Test-Mailto {
  try {
    $keuze = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\mailto\UserChoice' -Name ProgId -ErrorAction Stop
    if ($keuze.ProgId) { return $true }
  } catch { }
  return Test-Path -LiteralPath 'Registry::HKEY_CLASSES_ROOT\mailto\shell\open\command'
}

$code = @'
using System;
using System.Runtime.InteropServices;

public static class OfmMapi {
  const uint MAPI_LOGON_UI = 0x1;
  const uint MAPI_DIALOG = 0x8;
  const uint MAPI_TO = 1;

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class BerichtW {
    public uint reserved; public string onderwerp; public string tekst; public string soort;
    public string datum; public string gesprek; public uint vlaggen; public IntPtr afzender;
    public uint aantalOntvangers; public IntPtr ontvangers; public uint aantalBestanden; public IntPtr bestanden;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class OntvangerW {
    public uint reserved; public uint soort; public string naam; public string adres; public uint eidGrootte; public IntPtr eid;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class BestandW {
    public uint reserved; public uint vlaggen; public uint positie; public string pad; public string naam; public IntPtr soort;
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class BerichtA {
    public uint reserved; public string onderwerp; public string tekst; public string soort;
    public string datum; public string gesprek; public uint vlaggen; public IntPtr afzender;
    public uint aantalOntvangers; public IntPtr ontvangers; public uint aantalBestanden; public IntPtr bestanden;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class OntvangerA {
    public uint reserved; public uint soort; public string naam; public string adres; public uint eidGrootte; public IntPtr eid;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class BestandA {
    public uint reserved; public uint vlaggen; public uint positie; public string pad; public string naam; public IntPtr soort;
  }

  [DllImport("MAPI32.DLL", EntryPoint = "MAPISendMailW", CharSet = CharSet.Unicode)]
  static extern uint MAPISendMailW(IntPtr sessie, IntPtr venster, BerichtW bericht, uint vlaggen, uint reserved);
  [DllImport("MAPI32.DLL", EntryPoint = "MAPISendMail", CharSet = CharSet.Ansi)]
  static extern uint MAPISendMailA(IntPtr sessie, IntPtr venster, BerichtA bericht, uint vlaggen, uint reserved);

  static IntPtr NaarGeheugen(object waarde) {
    IntPtr p = Marshal.AllocHGlobal(Marshal.SizeOf(waarde));
    Marshal.StructureToPtr(waarde, p, false);
    return p;
  }

  static void Vrij(IntPtr p, Type soort) {
    if (p == IntPtr.Zero) return;
    Marshal.DestroyStructure(p, soort);
    Marshal.FreeHGlobal(p);
  }

  // Eerst de Unicode-versie (Windows 8+); ontbreekt die, dan de ANSI-versie.
  public static uint Open(string aan, string onderwerp, string tekst, string pad, string naam) {
    try {
      return OpenW(aan, onderwerp, tekst, pad, naam);
    } catch (EntryPointNotFoundException) {
      return OpenA(aan, onderwerp, tekst, pad, naam);
    }
  }

  static uint OpenW(string aan, string onderwerp, string tekst, string pad, string naam) {
    IntPtr ontvanger = IntPtr.Zero, bestand = IntPtr.Zero;
    try {
      BerichtW b = new BerichtW();
      b.onderwerp = onderwerp; b.tekst = tekst;
      if (aan.Length > 0) {
        OntvangerW o = new OntvangerW(); o.soort = MAPI_TO; o.naam = aan; o.adres = "SMTP:" + aan;
        ontvanger = NaarGeheugen(o); b.aantalOntvangers = 1; b.ontvangers = ontvanger;
      }
      BestandW f = new BestandW(); f.positie = 0xFFFFFFFF; f.pad = pad; f.naam = naam;
      bestand = NaarGeheugen(f); b.aantalBestanden = 1; b.bestanden = bestand;
      return MAPISendMailW(IntPtr.Zero, IntPtr.Zero, b, MAPI_LOGON_UI | MAPI_DIALOG, 0);
    } finally {
      Vrij(ontvanger, typeof(OntvangerW)); Vrij(bestand, typeof(BestandW));
    }
  }

  static uint OpenA(string aan, string onderwerp, string tekst, string pad, string naam) {
    IntPtr ontvanger = IntPtr.Zero, bestand = IntPtr.Zero;
    try {
      BerichtA b = new BerichtA();
      b.onderwerp = onderwerp; b.tekst = tekst;
      if (aan.Length > 0) {
        OntvangerA o = new OntvangerA(); o.soort = MAPI_TO; o.naam = aan; o.adres = "SMTP:" + aan;
        ontvanger = NaarGeheugen(o); b.aantalOntvangers = 1; b.ontvangers = ontvanger;
      }
      BestandA f = new BestandA(); f.positie = 0xFFFFFFFF; f.pad = pad; f.naam = naam;
      bestand = NaarGeheugen(f); b.aantalBestanden = 1; b.bestanden = bestand;
      return MAPISendMailA(IntPtr.Zero, IntPtr.Zero, b, MAPI_LOGON_UI | MAPI_DIALOG, 0);
    } finally {
      Vrij(ontvanger, typeof(OntvangerA)); Vrij(bestand, typeof(BestandA));
    }
  }
}
'@

$mapi = $null
try {
  Add-Type -TypeDefinition $code -Language CSharp
  $naam = [System.IO.Path]::GetFileName([string]$invoer.pad)
  $mapi = [int][OfmMapi]::Open([string]$invoer.aan, [string]$invoer.onderwerp, [string]$invoer.tekst, [string]$invoer.pad, $naam)
} catch {
  $mapi = $null
}

$uitkomst = @{ mapi = $mapi; mailto = [bool](Test-Mailto) }
[Console]::Out.WriteLine(($uitkomst | ConvertTo-Json -Compress))
exit 0
