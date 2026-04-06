import { createContext, useContext, useState, useEffect } from 'react'

const THEMES = [
  { id: 'female-light', name: '果凍奶茶', group: '女性', desc: '淡紫粉・圓潤溫暖' },
  { id: 'female-dark',  name: '深紫玫瑰', group: '女性', desc: '玫瑰紫・優雅沉穩' },
  { id: 'male-light',   name: '清新薄荷', group: '男性', desc: '薄荷藍綠・明亮專業' },
  { id: 'male-dark',    name: '深海藍',   group: '男性', desc: '深藍灰・科技俐落' },
  { id: 'neutral',      name: '暖棕大地', group: '中性', desc: '大地暖棕・自然質感' },
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => localStorage.getItem('pf-theme') || 'female-light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('pf-theme', themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
export { THEMES };
