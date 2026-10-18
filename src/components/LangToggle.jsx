import { useLang } from '../lib/i18n'

// Sélecteur de langue FR / EN en pilules (design « Grand ciel — réglages »),
// partagé par le panneau Réglages et l'écran d'accueil.
const LANGS = [
  ['fr', 'FR', 'Français'],
  ['en', 'EN', 'English'],
]

export default function LangToggle() {
  const { t, lang, toggleLang } = useLang()
  return (
    <div className="seg" role="group" aria-label={t('settings_language')}>
      {LANGS.map(([code, short, name]) => (
        <button
          key={code}
          type="button"
          className={'seg-btn narrow' + (lang === code ? ' active' : '')}
          aria-pressed={lang === code}
          aria-label={name}
          onClick={() => lang !== code && toggleLang()}
        >
          {short}
        </button>
      ))}
    </div>
  )
}
