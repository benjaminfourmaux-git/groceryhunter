import Icon from './Icon'
import { useLang } from '../lib/i18n'
import { setThemePref, useEffectiveTheme } from '../lib/theme'
import MorphPanel from './MorphPanel'
import LangToggle from './LangToggle'

export default function SettingsMenu({ open, onClose, onClosed, anchorRef, dockRef, onLeave }) {
  const { t } = useLang()
  const theme = useEffectiveTheme()
  return (
    <MorphPanel open={open} onClose={onClose} onClosed={onClosed}
      anchorRef={anchorRef} dockRef={dockRef} title={t('settings_title')}
      icon="more" className="settings-panel">
      <div className="settings-list">
        <div className="settings-row">
          <span className="settings-label">{t('settings_theme')}</span>
          <div className="seg" role="group" aria-label={t('settings_theme')}>
            <button
              type="button"
              className={'seg-btn' + (theme === 'light' ? ' active' : '')}
              aria-pressed={theme === 'light'}
              onClick={() => setThemePref('light')}
            >
              <Icon name="sun" size={14} strokeWidth={2.2} />
              {t('theme_light_short')}
            </button>
            <button
              type="button"
              className={'seg-btn' + (theme === 'dark' ? ' active' : '')}
              aria-pressed={theme === 'dark'}
              onClick={() => setThemePref('dark')}
            >
              <Icon name="moon" size={14} strokeWidth={2.2} />
              {t('theme_dark_short')}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-label">{t('settings_language')}</span>
          <LangToggle />
        </div>
        <button
          type="button"
          className="settings-row danger"
          onClick={() => {
            onClose()
            onLeave()
          }}
        >
          <span className="settings-label">{t('leave')}</span>
          <Icon name="logout" size={19} />
        </button>
      </div>
    </MorphPanel>
  )
}
