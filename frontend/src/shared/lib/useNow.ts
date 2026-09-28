import { useEffect, useState } from 'react'
import { nowDayMin } from './time'

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(nowDayMin)
  useEffect(() => {
    const id = setInterval(() => setNow(nowDayMin()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
