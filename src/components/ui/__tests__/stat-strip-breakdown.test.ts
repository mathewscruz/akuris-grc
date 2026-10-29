import { describe, it, expect } from 'vitest'
import { breakdownSegments } from '../stat-strip'

describe('breakdownSegments', () => {
  it('soma exatamente os valores reais', () => {
    const s = breakdownSegments([
      { label: 'C', value: 8, tone: 'critical' },
      { label: 'A', value: 14, tone: 'high' },
      { label: 'M', value: 12, tone: 'medium' },
      { label: 'B', value: 8, tone: 'low' },
    ])
    expect(s.reduce((a, b) => a + b.value, 0)).toBe(42)
    expect(s.reduce((a, b) => a + b.percent, 0)).toBeCloseTo(100)
  })
  it('sem divisão real não há barra', () => {
    expect(breakdownSegments([{ label: 'C', value: 0, tone: 'critical' }])).toEqual([])
    expect(breakdownSegments()).toEqual([])
  })
})
