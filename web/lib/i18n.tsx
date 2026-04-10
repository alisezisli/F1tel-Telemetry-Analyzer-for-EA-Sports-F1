"use client";

import { createContext, useContext, useState } from "react";

type Lang = "en" | "tr";

const translations = {
  en: {
    tagline: "Telemetry recorder and race analyzer for EA Sports F1 25.",
    description:
      "Record your sessions with the Windows desktop app. Upload the .f1tel file here to explore lap times, sector splits, speed traces, tyre temperatures, stint comparisons, and more. Everything is processed in your browser - your data never leaves your device.",
    downloadGatherer: "Download F1tel Gatherer",
    freeOpenSource: "Free, open source. Windows only. No Python installation required.",
    tryDemo: "Try Demo",
    dropFile: "Drop your .f1tel file here",
    orClickToBrowse: "or click to browse",
    maxSize: "Max 20 MB · F1 2025",
    seeItInAction: "See it in action",
    dashboard: "Dashboard",
    pleaseSelectFile: "Please select a .f1tel file.",
    readingFile: "Reading file...",
    loadingDemo: "Loading demo file...",
    demoNotFound: "Demo file not found on server.",
    uploadBack: "← Upload",
    laps: "laps",
    bestTheoretical: "Best theoretical",
    potential: "potential",
    sessionNotFound: "Session not found.",
    sessionMemoryNote: "Session data lives in browser memory and is lost when the tab is closed.",
    uploadAFile: "Upload a file",
    loading: "Loading...",
    panelLapSummary: "LAP SUMMARY",
    panelBestTheoreticalLap: "BEST THEORETICAL LAP",
    panelSectorAnalysis: "SECTOR ANALYSIS",
    panelSpeedTrace: "SPEED",
    panelTyreSurfaceTemp: "TYRE SURFACE TEMPERATURE",
    panelBrakeTemp: "BRAKE TEMPERATURE",
    panelTyreWear: "TYRE WEAR",
    panelStintComparison: "STINT COMPARISON",
    sectionTyresBrakes: "TYRES & BRAKES",
    zoomHint: "CTRL + scroll to zoom",
    colLap: "Lap",
    colTime: "Time",
    colDelta: "Delta",
    colPit: "Pit",
    colValid: "Valid",
    best: "Best",
    total: "Total",
    noLapData: "No lap data.",
    noValidLapData: "No valid lap data.",
    noTyreWearData: "No tyre wear data. Wear data is only available in Race sessions.",
    leftOnTable: "left on table",
    sector: "SECTOR",
    idealRange: "Ideal range",
    highlighted: "highlighted",
    lapLabel: "Lap",
    inStintLabel: "in stint",
    stintLabel: "Stint",
  },
  tr: {
    tagline: "EA Sports F1 25 için telemetri kaydedici ve yarış analizi.",
    description:
      "Oturumlarını Windows masaüstü uygulamasıyla kaydet. .f1tel dosyasını buraya yükleyerek tur süreleri, sektör zamanları, hız, lastik sıcaklıkları, stint karşılaştırmaları ve daha fazlasını keşfet. Her şey tarayıcında işlenir - verilerin cihazından çıkmaz.",
    downloadGatherer: "F1tel Gatherer'ı İndir",
    freeOpenSource: "Ücretsiz, açık kaynak. Sadece Windows. Python kurulumu gerekmez.",
    tryDemo: "Demoyu Dene",
    dropFile: ".f1tel dosyanı buraya sürükle",
    orClickToBrowse: "veya dosya seçmek için tıkla",
    maxSize: "Maks. 20 MB · F1 2025",
    seeItInAction: "Uygulamalı görün",
    dashboard: "Dashboard",
    pleaseSelectFile: "Lütfen bir .f1tel dosyası seçin.",
    readingFile: "Dosya okunuyor...",
    loadingDemo: "Demo dosyası yükleniyor...",
    demoNotFound: "Demo dosyası sunucuda bulunamadı.",
    uploadBack: "← Yükle",
    laps: "tur",
    bestTheoretical: "En iyi teorik",
    potential: "potansiyel",
    sessionNotFound: "Oturum bulunamadı.",
    sessionMemoryNote: "Oturum verisi tarayıcı belleğinde tutulur ve sekme kapatılınca silinir.",
    uploadAFile: "Dosya yükle",
    loading: "Yükleniyor...",
    panelLapSummary: "TUR ÖZETİ",
    panelBestTheoreticalLap: "EN İYİ TEORİK TUR",
    panelSectorAnalysis: "SEKTÖR ANALİZİ",
    panelSpeedTrace: "HIZ",
    panelTyreSurfaceTemp: "LASTİK YÜZEY SICAKLIĞI",
    panelBrakeTemp: "FREN SICAKLIĞI",
    panelTyreWear: "LASTİK AŞINMASI",
    panelStintComparison: "STINT KARŞILAŞTIRMASI",
    sectionTyresBrakes: "LASTİKLER & FRENLER",
    zoomHint: "CTRL + fare tekerleği ile yakınlaştır",
    colLap: "Tur",
    colTime: "Süre",
    colDelta: "Delta",
    colPit: "Pit",
    colValid: "Geçerli",
    best: "En İyi",
    total: "Toplam",
    noLapData: "Tur verisi yok.",
    noValidLapData: "Geçerli tur verisi yok.",
    noTyreWearData: "Lastik aşınma verisi yok. Aşınma verisi yalnızca Yarış oturumlarında mevcut.",
    leftOnTable: "potansiyel kazanım",
    sector: "SEKTÖR",
    idealRange: "İdeal Aralık",
    highlighted: "vurgulanmış",
    lapLabel: "Tur",
    inStintLabel: "/ stint",
    stintLabel: "Stint",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations.en[key],
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = (key: TranslationKey): string => translations[lang][key];
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
      <div className="fixed top-3 right-4 z-40 flex gap-1">
        {(["EN", "TR"] as const).map((label) => {
          const l = label.toLowerCase() as Lang;
          return (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="text-xs px-2 py-1 rounded font-medium"
              style={{
                background: lang === l ? "var(--accent)" : "var(--muted)",
                color: lang === l ? "#fff" : "var(--muted-foreground)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </LangContext.Provider>
  );
}

export function useT() {
  return useContext(LangContext).t;
}
