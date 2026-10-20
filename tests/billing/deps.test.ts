import { defaultDeps } from '../../lib/billing/deps'
import { getUsersDb } from '../../lib/billing/db'

jest.mock('../../lib/billing/db', () => ({ getUsersDb: jest.fn(() => { throw new Error('opened') }) }))

describe('defaultDeps (Ruling W: db is opened lazily)', () => {
  it('does not open the users database until deps.db is first used', () => {
    const d = defaultDeps()
    expect(getUsersDb).not.toHaveBeenCalled()
    expect(() => d.db).toThrow('opened')
    expect(getUsersDb).toHaveBeenCalledTimes(1)
  })
})
