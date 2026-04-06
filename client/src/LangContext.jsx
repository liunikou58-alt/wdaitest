import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import zhTW from './i18n/zh-TW'
import en from './i18n/en'

const LANGS = { 'zh-TW': zhTW, en };
const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('wdmc-ai-lang') || 'zh-TW');

  useEffect(() => {
    localStorage.setItem('wdmc-ai-lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const t = useCallback((key, params) => {
    const val = LANGS[lang]?.[key] || LANGS['zh-TW']?.[key] || key;
    if (!params) return val;
    return Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), val);
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() { return useContext(LangContext); }
