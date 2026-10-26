/**
 * Formularfelder im Design-Stil (Label oben, eckige Hairline-Inputs).
 */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

function Label({ text, required, children }: { text: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] text-accent-300">
        {text}
        {required && <span className="text-accent-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

export function TextField({ label, required, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label text={label} required={required}>
      <input className="input" required={required} {...rest} />
    </Label>
  )
}

export function TextArea({ label, ...rest }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Label text={label}>
      <textarea className="input min-h-[90px] resize-y" {...rest} />
    </Label>
  )
}

export function SelectField({
  label,
  required,
  options,
  ...rest
}: { label: string; options: { value: string; label: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Label text={label} required={required}>
      <select className="input cursor-pointer appearance-none bg-ground" required={required} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  )
}

/** Zwei Felder nebeneinander. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
