export function sentence(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase())
}

export function dateTime(value: string | null): string {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
