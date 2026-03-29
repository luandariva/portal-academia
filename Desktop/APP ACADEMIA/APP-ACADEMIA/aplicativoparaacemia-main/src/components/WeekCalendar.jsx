import { useEffect, useRef, useMemo } from 'react'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
const DAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function WeekCalendar({ selectedDate, onSelectDate }) {
  const containerRef = useRef(null)

  const days = useMemo(() => {
    const list = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = -15; i <= 15; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      list.push(d)
    }
    return list
  }, [])

  const headerText = useMemo(() => {
    if (!selectedDate) return ''
    const m = MONTH_NAMES[selectedDate.getMonth()]
    const y = selectedDate.getFullYear()
    return `${m} ${y}`
  }, [selectedDate])

  useEffect(() => {
    if (!containerRef.current || !selectedDate) return
    const activeEl = containerRef.current.querySelector('.cal-item-active')
    if (activeEl) {
      const parent = containerRef.current
      const offset = activeEl.offsetLeft - parent.offsetWidth / 2 + activeEl.offsetWidth / 2
      parent.scrollTo({ left: offset, behavior: 'smooth' })
    }
  }, [selectedDate])

  function isSameDay(d1, d2) {
    if (!d1 || !d2) return false
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
  }

  return (
    <div className="anim" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#fff', margin: 0, marginLeft: 2 }}>
        {headerText}
      </h2>

      <div 
        ref={containerRef}
        style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 14, msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        className="hide-scroll-cal"
      >
        <style dangerouslySetInnerHTML={{__html: `.hide-scroll-cal::-webkit-scrollbar { display: none; }`}} />

        {days.map((d) => {
          const active = isSameDay(d, selectedDate)
          return (
            <div 
              key={d.toISOString()}
              className={`cal-item ${active ? 'cal-item-active' : ''}`}
              onClick={() => onSelectDate(d)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minWidth: 50, height: 66, borderRadius: 'var(--radius)',
                background: active ? 'var(--lime)' : 'var(--bg-3)',
                color: active ? '#000' : 'var(--text-2)',
                cursor: 'pointer', transition: 'all 0.2s', position: 'relative', flexShrink: 0,
                border: active ? 'none' : '1px solid var(--border-2)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, marginBottom: 4, color: active ? '#333' : 'var(--text-3)' }}>
                {DAY_NAMES[d.getDay()]}
              </span>
              <span style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                {d.getDate()}
              </span>

              {active && (
                <div style={{ position: 'absolute', bottom: -10, width: 5, height: 5, borderRadius: '50%', background: 'var(--lime)' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
