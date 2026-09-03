import { useEffect, useState } from 'react'

/**
 * Текущее время, обновляемое своим таймером.
 *
 * Значение, посчитанное от «сейчас», без собственного тика замерзает на
 * моменте отрисовки: карточка, открытая в 10:00, до самого закрытия пишет
 * «останній рух 5 хвилин тому», хотя прошёл час. Перерисовку по приходу данных
 * ждать нельзя — запрос может не повториться ни разу.
 *
 * Тик раз в минуту: мельче не имеет смысла (показываем минуты и часы), крупнее
 * — уже заметно врёт.
 */
export function useNowTick(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
