import { useLang } from '../lib/i18n'

// Drapeaux en SVG (nets à petite taille), détourés en cercle pour coller au
// format rond des autres boutons d'icône.
function FlagFR() {
  return (
    <svg className="flag" viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
      <defs>
        <clipPath id="flag-fr">
          <circle cx="12" cy="12" r="11.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-fr)">
        <rect width="8" height="24" fill="#0055A4" />
        <rect x="8" width="8" height="24" fill="#fff" />
        <rect x="16" width="8" height="24" fill="#EF4135" />
      </g>
      <circle cx="12" cy="12" r="11" fill="none" stroke="rgba(255,255,255,0.28)" />
    </svg>
  )
}

function FlagGB() {
  return (
    <svg className="flag" viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
      <defs>
        <clipPath id="flag-gb">
          <circle cx="12" cy="12" r="11.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-gb)">
        <rect width="24" height="24" fill="#012169" />
        <path d="M0 0 24 24M24 0 0 24" stroke="#fff" strokeWidth="3.6" />
        <path d="M0 0 24 24M24 0 0 24" stroke="#C8102E" strokeWidth="1.7" />
        <path d="M12 0V24M0 12H24" stroke="#fff" strokeWidth="6.2" />
        <path d="M12 0V24M0 12H24" stroke="#C8102E" strokeWidth="3.6" />
      </g>
      <circle cx="12" cy="12" r="11" fill="none" stroke="rgba(255,255,255,0.28)" />
    </svg>
  )
}

export default function LangToggle() {
  const { lang, toggleLang, t } = useLang()
  return (
    <button
      type="button"
      className="icon-btn lang"
      onClick={toggleLang}
      aria-label={t('lang_toggle')}
      title={t('lang_toggle')}
    >
      {lang === 'fr' ? <FlagFR /> : <FlagGB />}
    </button>
  )
}
