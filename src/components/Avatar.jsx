import { avatarTone, initials } from '../lib/colors'

export default function Avatar({ name, color, size = 32, title }) {
  return (
    <span
      className="avatar"
      title={title || name}
      style={{
        width: size,
        height: size,
        background: `var(--av-${avatarTone(color)})`,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials(name)}
    </span>
  )
}
