import { useCurrency, useLang } from '../lib/i18n'

export default function CurrencyToggle() {
  const { currency, currencySymbol, cycleCurrency } = useCurrency()
  const { t } = useLang()
  return (
    <button
      type="button"
      className="icon-btn currency"
      onClick={cycleCurrency}
      aria-label={t('currency_toggle')}
      title={`${t('currency_toggle')} (${currency})`}
    >
      <span className="currency-symbol">{currencySymbol}</span>
    </button>
  )
}
