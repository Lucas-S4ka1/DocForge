import { Corners } from '../ui/Panel'

/** "DF"-Logo-Kachel mit Registriermarken. */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <div
      className="blueprint grid flex-none place-items-center border-accent-500 shadow-glow"
      style={{ width: size, height: size }}
    >
      <Corners />
      <span
        className="font-heading font-semibold leading-none tracking-[0.04em] text-accent-300"
        style={{ fontSize: size * 0.43 }}
      >
        DF
      </span>
    </div>
  )
}
