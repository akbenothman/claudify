import { useState } from 'react'
import type { Account, Recurring } from '../../../shared/types'
import { Icon } from './Icon'
import { Blank, Card, Meter, Page, Stat } from './Page'
import { money, moneyExact, newId, nowIso, perMonth, useDashboard } from '../useDashboard'

/**
 * Finance. Balances on the left, the money that moves on its own on the right,
 * and net worth across the top.
 *
 * Everything is entered by hand (or by Claude editing the file) — claudify has
 * no bank connection and wants none. The value is in seeing the whole picture
 * in one place, not in it being live to the cent.
 */

export function FinancePane() {
  const { data, update } = useDashboard()
  const [acct, setAcct] = useState('')
  const [item, setItem] = useState('')

  const fin = data?.finance ?? { accounts: [], recurring: [], currency: '$' }
  const currency = fin.currency ?? '$'
  const accounts = fin.accounts
  const recurring = fin.recurring

  const patchFin = (fn: (f: typeof fin) => typeof fin) =>
    update((d) => ({ ...d, finance: fn(d.finance) }))

  const addAccount = () => {
    const name = acct.trim()
    if (!name) return
    setAcct('')
    patchFin((f) => ({
      ...f,
      accounts: [...f.accounts, { id: newId(), name, balance: 0, updated: nowIso() }]
    }))
  }

  const patchAccount = (id: string, p: Partial<Account>) =>
    patchFin((f) => ({
      ...f,
      accounts: f.accounts.map((a) => (a.id === id ? { ...a, ...p, updated: nowIso() } : a))
    }))

  const addRecurring = () => {
    const name = item.trim()
    if (!name) return
    setItem('')
    patchFin((f) => ({
      ...f,
      recurring: [
        ...f.recurring,
        { id: newId(), name, amount: 0, cadence: 'monthly', direction: 'out', updated: nowIso() }
      ]
    }))
  }

  const patchRecurring = (id: string, p: Partial<Recurring>) =>
    patchFin((f) => ({
      ...f,
      recurring: f.recurring.map((r) => (r.id === id ? { ...r, ...p, updated: nowIso() } : r))
    }))

  const assets = accounts.filter((a) => !a.liability).reduce((n, a) => n + a.balance, 0)
  const debts = accounts.filter((a) => a.liability).reduce((n, a) => n + a.balance, 0)
  const net = assets - debts

  const income = recurring
    .filter((r) => r.direction === 'in')
    .reduce((n, r) => n + perMonth(r.amount, r.cadence), 0)
  const spend = recurring
    .filter((r) => r.direction === 'out')
    .reduce((n, r) => n + perMonth(r.amount, r.cadence), 0)
  const surplus = income - spend

  // How long the liquid pile lasts if the income stopped and spending didn't.
  const runway = spend > 0 ? assets / spend : 0
  const target = fin.savingsTarget ?? 0
  const empty = accounts.length === 0 && recurring.length === 0

  return (
    <Page
      kind="finance"
      title="Finance"
      subtitle={
        empty
          ? 'Balances, bills and what is left over'
          : `${accounts.length} accounts · ${recurring.length} recurring`
      }
    >
      {!empty && (
        <div className="stat-row">
          <Stat
            label="Net worth"
            value={<span title={moneyExact(net, currency)}>{money(net, currency)}</span>}
            tone={net >= 0 ? 'up' : 'down'}
            hint={debts > 0 ? `${money(assets, currency)} less ${money(debts, currency)} owed` : undefined}
          />
          <Stat
            label="Monthly surplus"
            value={
              <span title={moneyExact(surplus, currency)}>
                {surplus >= 0 ? '+' : ''}
                {money(surplus, currency)}
              </span>
            }
            tone={surplus >= 0 ? 'up' : 'down'}
            hint={`${money(income, currency)} in · ${money(spend, currency)} out`}
          />
          <Stat
            label="Runway"
            value={spend > 0 ? `${runway.toFixed(1)} mo` : '—'}
            tone={runway >= 6 ? 'up' : runway > 0 && runway < 3 ? 'down' : undefined}
            hint={spend > 0 ? 'if the income stopped today' : 'add outgoings to see this'}
          />
          {target > 0 && (
            <Stat
              label="Savings target"
              value={`${Math.min(100, Math.round((assets / target) * 100))}%`}
              tone="accent"
              hint={<Meter pct={(assets / target) * 100} />}
            />
          )}
        </div>
      )}

      {empty && (
        <Blank
          icon="finance"
          text="Nothing tracked yet"
          hint="Add an account and a recurring bill below — or have Claude fill them in."
        />
      )}

      <div className="two-col">
        <Card
          title="Accounts"
          action={
            <span className="dim" title={moneyExact(assets, currency)}>
              {money(assets, currency)} in assets
            </span>
          }
        >
          <div className="fin-list">
            {accounts.map((a) => (
              <div key={a.id} className={`fin-row${a.liability ? ' liability' : ''}`}>
                <input
                  className="fin-name"
                  defaultValue={a.name}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => e.target.value.trim() && patchAccount(a.id, { name: e.target.value.trim() })}
                />
                <input
                  className="fin-kind"
                  defaultValue={a.kind ?? ''}
                  placeholder="type"
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => patchAccount(a.id, { kind: e.target.value.trim() || undefined })}
                />
                <button
                  className={`toggle${a.liability ? ' on' : ''}`}
                  title="Count this as a debt"
                  onClick={() => patchAccount(a.id, { liability: !a.liability })}
                >
                  {a.liability ? 'debt' : 'asset'}
                </button>
                <input
                  type="number"
                  className="num fin-amount"
                  defaultValue={a.balance}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => patchAccount(a.id, { balance: Number(e.target.value) || 0 })}
                />
                <button
                  className="ghost-x"
                  title="Remove"
                  onClick={() =>
                    patchFin((f) => ({ ...f, accounts: f.accounts.filter((x) => x.id !== a.id) }))
                  }
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="inline-add">
            <input
              value={acct}
              placeholder="New account…"
              onChange={(e) => setAcct(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') addAccount()
              }}
            />
            <button onClick={addAccount}>
              <Icon name="plus" size={12} />
            </button>
          </div>
        </Card>

        <Card
          title="Recurring"
          action={
            <span className="dim" title={moneyExact(spend, currency)}>
              {money(spend, currency)}/mo out
            </span>
          }
        >
          <div className="fin-list">
            {recurring.map((r) => (
              <div key={r.id} className={`fin-row dir-${r.direction}`}>
                <input
                  className="fin-name"
                  defaultValue={r.name}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) =>
                    e.target.value.trim() && patchRecurring(r.id, { name: e.target.value.trim() })
                  }
                />
                <button
                  className={`toggle${r.direction === 'in' ? ' in' : ' out'}`}
                  title="Income or outgoing"
                  onClick={() =>
                    patchRecurring(r.id, { direction: r.direction === 'in' ? 'out' : 'in' })
                  }
                >
                  {r.direction === 'in' ? 'in' : 'out'}
                </button>
                <select
                  className="select"
                  value={r.cadence}
                  onChange={(e) =>
                    patchRecurring(r.id, { cadence: e.target.value as Recurring['cadence'] })
                  }
                >
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                  <option value="yearly">yearly</option>
                </select>
                <input
                  type="number"
                  className="num fin-amount"
                  defaultValue={r.amount}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => patchRecurring(r.id, { amount: Number(e.target.value) || 0 })}
                />
                <button
                  className="ghost-x"
                  title="Remove"
                  onClick={() =>
                    patchFin((f) => ({ ...f, recurring: f.recurring.filter((x) => x.id !== r.id) }))
                  }
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="inline-add">
            <input
              value={item}
              placeholder="New bill or income…"
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') addRecurring()
              }}
            />
            <button onClick={addRecurring}>
              <Icon name="plus" size={12} />
            </button>
          </div>
        </Card>
      </div>
    </Page>
  )
}
