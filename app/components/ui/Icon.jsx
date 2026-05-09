import * as LucideIcons from 'lucide-react'

/**
 * Icon — thin wrapper around lucide-react.
 * Props:
 *   name     string   — PascalCase lucide icon name, e.g. "MapPin"
 *   size     number   — px, default 18
 *   stroke   number   — strokeWidth, default 1.75
 *   color    string   — CSS color, default "currentColor"
 *   className string
 */
export default function Icon({ name, size = 18, stroke = 1.75, color = 'currentColor', className = '' }) {
  const LucideIcon = LucideIcons[name]
  if (!LucideIcon) return null
  return <LucideIcon size={size} strokeWidth={stroke} color={color} className={className} />
}
