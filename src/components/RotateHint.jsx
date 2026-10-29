import { useLang } from '../lib/i18n'

// App pensée pour le portrait. iOS ne permet pas à une page de bloquer la
// rotation : sur un téléphone tourné en paysage, ce voile (affiché en CSS
// uniquement dans ce cas) invite à le remettre droit.
export default function RotateHint() {
  const { t } = useLang()
  return (
    <div className="rotate-hint" role="alert" aria-live="polite">
      <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
      </svg>
      <p>{t('rotate_hint')}</p>
    </div>
  )
}
