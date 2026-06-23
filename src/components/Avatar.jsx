import { initials } from '../lib/colors'

export default function Avatar({ name, color = '#0E8C7F', size = 36, title }) {
  return (
    <span
      className="avatar"
      title={title || name}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials(name)}
    </span>
  )
}
