import { DEFAULT_OMDB_DAILY_BUDGET, omdbBudgetExhausted, resetOmdbBudgetForTests, secondsUntilBudgetReset, takeOmdbCall } from '../../lib/omdb-budget'

const T0 = Date.parse('2026-10-20T10:00:00Z')

describe('omdb daily budget', () => {
  beforeEach(() => resetOmdbBudgetForTests())

  it('allows exactly the budget, then refuses', () => {
    for (let i = 0; i < 3; i++) expect(takeOmdbCall(T0, 3)).toBe(true)
    expect(omdbBudgetExhausted(T0, 3)).toBe(true)
    expect(takeOmdbCall(T0, 3)).toBe(false)
  })

  it('resets at UTC midnight, not on a rolling 24 hours', () => {
    resetOmdbBudgetForTests()
    takeOmdbCall(T0, 1)
    expect(takeOmdbCall(Date.parse('2026-10-20T23:59:59Z'), 1)).toBe(false)
    expect(takeOmdbCall(Date.parse('2026-10-21T00:00:00Z'), 1)).toBe(true)
    expect(takeOmdbCall(Date.parse('2026-10-21T00:00:01Z'), 1)).toBe(false)
  })

  it('reports whole seconds to the next UTC midnight', () => {
    takeOmdbCall(T0, 5)
    expect(secondsUntilBudgetReset(T0)).toBe(14 * 3600)
    expect(secondsUntilBudgetReset(Date.parse('2026-10-20T23:59:59.500Z'))).toBe(1)
  })

  it('keeps a margin under the 1,000/day free tier by default', () => {
    expect(DEFAULT_OMDB_DAILY_BUDGET).toBeLessThan(1000)
    expect(DEFAULT_OMDB_DAILY_BUDGET).toBe(900)
  })
})
