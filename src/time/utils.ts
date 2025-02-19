// Add these imports at the top

// Add these interfaces
interface TimeRange {
  value: string
  label: string
}

// Add these constants
export const timeRanges: TimeRange[] = [
  { value: 'minute', label: 'Last Minute' },
  { value: 'hour', label: 'Last Hour' },
  { value: 'day', label: 'Last Day' },
  { value: 'week', label: 'Last Week' },
  { value: 'month', label: 'Last Month' }
]