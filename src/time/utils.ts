

interface TimeRange {
  value: string
  label: string
}

export const timeRanges: TimeRange[] = [
  { value: 'minute', label: 'Last Minute' },
  { value: 'hour', label: 'Last Hour' },
  { value: 'day', label: 'Last Day' },
  { value: 'week', label: 'Last Week' },
  { value: 'month', label: 'Last Month' }
]