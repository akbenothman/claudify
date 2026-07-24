import { useState } from 'react'
import type { Account, Budget, Recurring, SavingsGoal, Transaction } from '../../../shared/types'
import { Icon } from './Icon'
import { Blank, Card, Meter, Page, Stat } from './Page'
import {
  dayKey,
  inMonth,
  money,
  moneyExact,
  monthName,
  newId,
  nowIso,
  perMonth,
  thisMonth,
  useDashboard
} from '../useDashboard'

/**
 * Finance — a proper money tracker, not just a balance sheet.
 *
 * The page reads top-down the way the big consumer apps are laid out, minus the
 * bank connection claudify neither has nor wants: net worth and cash flow across
 * the top; where the money actually went this month; budgets measured against
 * that spend (YNAB/EveryDollar); the accounts and the bills that move on their
 * own; the ledger those spending figures come from; and the savings goals it is
 * all in aid of.
 *
 * Two numbers people conflate are kept apart on purpose. The recurring list is
 * the *plan* — what should come and go each month. The transaction ledger is
 * what *actually* happened. Surfacing both, and the gap between them, is the
 * whole point of a tracker over a spreadsheet of balances.
 *
 * Everything is entered by hand or written by Claude editing the JSON file.
 */

const CATEGORY_HINTS = ['Groceries', 'Rent', 'Dining', 'Transport', 'Utilities', 'Subscriptions']

export function FinancePane() {
  const { data, update } = useDashboard()
  const [acct, setAcct] = useState('')
  const [item, setItem] = useState('')
  const [bCat, setBCat] = useState('')
  const [bLimit, setBLimit] = useState('')
  const [gName, setGName] = useState('')
  const [gTarget, setGTarget] = useState('')
  const [txn, setTxn] = useState({ date: dayKey(), desc: '', category: '', amount: '', dir: 'out' as 'in' | 'out' })
  const [showAllTxns, setShowAllTxns] = useState(false)

  const fin = data?.finance ?? { accounts: [], recurring: [], currency: '$' }
  const currency = fin.currency ?? '$'
  const accounts = fin.accounts
  const recurring = fin.recurring
  const transactions = fin.transactions ?? []
  const budgets = fin.budgets ?? []
  const goals = fin.goals ?? []

  const patchFin = (fn: (f: typeof fin) => typeof fin) =>
    update((d) => ({ ...d, finance: fn(d.finance) }))

  /* ------------------------------- accounts ------------------------------- */

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

  /* ------------------------------ recurring ------------------------------- */

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

  /* ----------------------------- transactions ----------------------------- */

  const addTxn = () => {
    const desc = txn.desc.trim()
    const amount = Math.abs(Number(txn.amount) || 0)
    if (!desc || amount === 0) return
    const t: Transaction = {
      id: newId(),
      date: txn.date || dayKey(),
      desc,
      amount,
      direction: txn.dir,
      category: txn.category.trim() || undefined,
      updated: nowIso()
    }
    patchFin((f) => ({ ...f, transactions: [t, ...(f.transactions ?? [])] }))
    setTxn((s) => ({ ...s, desc: '', category: '', amount: '' }))
  }

  const patchTxn = (id: string, p: Partial<Transaction>) =>
    patchFin((f) => ({
      ...f,
      transactions: (f.transactions ?? []).map((t) =>
        t.id === id ? { ...t, ...p, updated: nowIso() } : t
      )
    }))

  const removeTxn = (id: string) =>
    patchFin((f) => ({ ...f, transactions: (f.transactions ?? []).filter((t) => t.id !== id) }))

  /* ------------------------------- budgets -------------------------------- */

  const addBudget = () => {
    const category = bCat.trim()
    if (!category) return
    setBCat('')
    setBLimit('')
    patchFin((f) => ({
      ...f,
      budgets: [
        ...(f.budgets ?? []),
        { id: newId(), category, limit: Math.abs(Number(bLimit) || 0), updated: nowIso() }
      ]
    }))
  }

  const patchBudget = (id: string, p: Partial<Budget>) =>
    patchFin((f) => ({
      ...f,
      budgets: (f.budgets ?? []).map((b) => (b.id === id ? { ...b, ...p, updated: nowIso() } : b))
    }))

  const removeBudget = (id: string) =>
    patchFin((f) => ({ ...f, budgets: (f.budgets ?? []).filter((b) => b.id !== id) }))

  /* -------------------------------- goals --------------------------------- */

  const addGoal = () => {
    const name = gName.trim()
    if (!name) return
    setGName('')
    setGTarget('')
    patchFin((f) => ({
      ...f,
      goals: [
        ...(f.goals ?? []),
        { id: newId(), name, target: Math.abs(Number(gTarget) || 0), saved: 0, updated: nowIso() }
      ]
    }))
  }

  const patchGoal = (id: string, p: Partial<SavingsGoal>) =>
    patchFin((f) => ({
      ...f,
      goals: (f.goals ?? []).map((g) => (g.id === id ? { ...g, ...p, updated: nowIso() } : g))
    }))

  const removeGoal = (id: string) =>
    patchFin((f) => ({ ...f, goals: (f.goals ?? []).filter((g) => g.id !== id) }))

  /* ------------------------------ derived --------------------------------- */

  const assets = accounts.filter((a) => !a.liability).reduce((n, a) => n + a.balance, 0)
  const debts = accounts.filter((a) => a.liability).reduce((n, a) => n + a.balance, 0)
  const net = assets - debts

  // The plan: what the recurring rows say should move each month.
  const planIn = recurring
    .filter((r) => r.direction === 'in')
    .reduce((n, r) => n + perMonth(r.amount, r.cadence), 0)
  const planOut = recurring
    .filter((r) => r.direction === 'out')
    .reduce((n, r) => n + perMonth(r.amount, r.cadence), 0)
  const planSurplus = planIn - planOut

  // What actually happened this month, from the ledger.
  const month = thisMonth()
  const monthTxns = transactions.filter((t) => inMonth(t.date, month))
  const monthIn = monthTxns.filter((t) => t.direction === 'in').reduce((n, t) => n + t.amount, 0)
  const monthOut = monthTxns.filter((t) => t.direction === 'out').reduce((n, t) => n + t.amount, 0)
  const monthNet = monthIn - monthOut
  const hasTxns = transactions.length > 0

  // Savings rate — the headline metric Copilot and Monarch lead with. Prefer the
  // actual ledger; fall back to the plan so the number still means something
  // before any transactions are logged.
  const rateIn = hasTxns ? monthIn : planIn
  const rateNet = hasTxns ? monthNet : planSurplus
  const savingsRate = rateIn > 0 ? (rateNet / rateIn) * 100 : null

  // Spending this month, by category, biggest first. Categories match
  // case-insensitively (so "Dining" and "dining" are one line, the same way the
  // budgets tally them), keeping the first spelling seen as the label.
  const spendByCat = new Map<string, { label: string; total: number }>()
  for (const t of monthTxns) {
    if (t.direction !== 'out') continue
    const label = (t.category ?? '').trim() || 'Uncategorised'
    const key = label.toLowerCase()
    const cur = spendByCat.get(key)
    spendByCat.set(key, { label: cur?.label ?? label, total: (cur?.total ?? 0) + t.amount })
  }
  const spendCats = [...spendByCat.values()].sort((a, b) => b.total - a.total)

  const spentInCategory = (category: string) => {
    const key = category.trim().toLowerCase()
    return monthTxns
      .filter((t) => t.direction === 'out' && (t.category ?? '').trim().toLowerCase() === key)
      .reduce((n, t) => n + t.amount, 0)
  }

  const budgetTotal = budgets.reduce((n, b) => n + b.limit, 0)
  const budgetSpent = budgets.reduce((n, b) => n + spentInCategory(b.category), 0)

  // Runway on the liquid pile if income stopped and spending didn't. Use actual
  // spend when we have it, otherwise the planned outgoings.
  const burn = hasTxns && monthOut > 0 ? monthOut : planOut
  const runway = burn > 0 ? assets / burn : 0

  // Legacy single target still honoured; a real goals list takes precedence.
  const legacyTarget = fin.savingsTarget ?? 0
  const goalTargetSum = goals.reduce((n, g) => n + g.target, 0)
  const goalSavedSum = goals.reduce((n, g) => n + g.saved, 0)

  const empty =
    accounts.length === 0 &&
    recurring.length === 0 &&
    transactions.length === 0 &&
    budgets.length === 0 &&
    goals.length === 0

  const shownTxns = showAllTxns ? transactions : transactions.slice(0, 12)

  return (
    <Page
      kind="finance"
      title="Finance"
      subtitle={
        empty
          ? 'Net worth, spending, budgets and goals — the whole picture'
          : `Net worth ${money(net, currency)} · ${monthName(month)}`
      }
    >
      {!empty && (
        <div className="stat-row">
          <Stat
            label="Net worth"
            value={<span title={moneyExact(net, currency)}>{money(net, currency)}</span>}
            tone={net >= 0 ? 'up' : 'down'}
            hint={
              debts > 0
                ? `${money(assets, currency)} less ${money(debts, currency)} owed`
                : 'assets, nothing owed'
            }
          />
          <Stat
            label={hasTxns ? 'This month' : 'Monthly plan'}
            value={
              <span title={moneyExact(hasTxns ? monthNet : planSurplus, currency)}>
                {(hasTxns ? monthNet : planSurplus) >= 0 ? '+' : ''}
                {money(hasTxns ? monthNet : planSurplus, currency)}
              </span>
            }
            tone={(hasTxns ? monthNet : planSurplus) >= 0 ? 'up' : 'down'}
            hint={
              hasTxns
                ? `${money(monthIn, currency)} in · ${money(monthOut, currency)} out`
                : `${money(planIn, currency)} in · ${money(planOut, currency)} out, as planned`
            }
          />
          {savingsRate !== null && (
            <Stat
              label="Savings rate"
              value={`${Math.round(savingsRate)}%`}
              tone={savingsRate >= 20 ? 'up' : savingsRate < 0 ? 'down' : undefined}
              hint={hasTxns ? 'of income kept this month' : 'of income kept, as planned'}
            />
          )}
          {budgets.length > 0 ? (
            <Stat
              label="Budget"
              value={
                <span title={`${moneyExact(budgetSpent, currency)} of ${moneyExact(budgetTotal, currency)}`}>
                  {budgetTotal > 0 ? `${Math.round((budgetSpent / budgetTotal) * 100)}%` : '—'}
                </span>
              }
              tone={budgetSpent > budgetTotal ? 'down' : 'accent'}
              hint={
                <Meter
                  pct={budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0}
                  tone={budgetSpent > budgetTotal ? 'down' : undefined}
                />
              }
            />
          ) : (
            <Stat
              label="Runway"
              value={burn > 0 ? `${runway.toFixed(1)} mo` : '—'}
              tone={runway >= 6 ? 'up' : burn > 0 && runway < 3 ? 'down' : undefined}
              hint={burn > 0 ? 'if the income stopped today' : 'add spending to see this'}
            />
          )}
        </div>
      )}

      {empty && (
        <Blank
          icon="finance"
          text="Nothing tracked yet"
          hint="Add an account, log a transaction, or set a budget below — or have Claude fill them in."
        />
      )}

      {/* Where the money went, and the budgets that measure it. */}
      {(spendCats.length > 0 || budgets.length > 0) && (
        <div className="two-col">
          <Card
            title="Spending this month"
            action={
              <span className="dim" title={moneyExact(monthOut, currency)}>
                {money(monthOut, currency)} out
              </span>
            }
          >
            {spendCats.length === 0 ? (
              <div className="blank-inline">No spending logged this month.</div>
            ) : (
              <div className="spend-list">
                {spendCats.map(({ label, total }) => (
                  <div key={label} className="spend-row">
                    <div className="spend-head">
                      <span className="spend-cat">{label}</span>
                      <span className="spend-share">
                        {monthOut > 0 ? Math.round((total / monthOut) * 100) : 0}%
                      </span>
                      <span className="spend-amt" title={moneyExact(total, currency)}>
                        {money(total, currency)}
                      </span>
                    </div>
                    <Meter pct={monthOut > 0 ? (total / monthOut) * 100 : 0} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Budgets"
            action={
              budgetTotal > 0 ? (
                <span className="dim" title={`${moneyExact(budgetSpent, currency)} of ${moneyExact(budgetTotal, currency)}`}>
                  {money(budgetSpent, currency)} of {money(budgetTotal, currency)}
                </span>
              ) : undefined
            }
          >
            <div className="budget-list">
              {budgets.map((b) => {
                const spent = spentInCategory(b.category)
                const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0
                const over = spent > b.limit && b.limit > 0
                const left = b.limit - spent
                return (
                  <div key={b.id} className={`budget-row${over ? ' over' : ''}`}>
                    <div className="budget-head">
                      <input
                        className="budget-cat"
                        defaultValue={b.category}
                        onKeyDown={(e) => e.stopPropagation()}
                        onBlur={(e) =>
                          e.target.value.trim() && patchBudget(b.id, { category: e.target.value.trim() })
                        }
                      />
                      <span className="budget-nums" title={`${moneyExact(spent, currency)} of ${moneyExact(b.limit, currency)}`}>
                        {money(spent, currency)}
                        <span className="dim"> / </span>
                        <input
                          type="number"
                          className="num budget-limit"
                          defaultValue={b.limit}
                          onKeyDown={(e) => e.stopPropagation()}
                          onBlur={(e) => patchBudget(b.id, { limit: Math.abs(Number(e.target.value) || 0) })}
                        />
                      </span>
                      <button className="ghost-x" title="Remove" onClick={() => removeBudget(b.id)}>
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                    <Meter pct={pct} tone={over ? 'down' : pct >= 85 ? 'warn' : undefined} />
                    <div className={`budget-left${over ? ' over' : ''}`}>
                      {b.limit === 0
                        ? 'no limit set'
                        : over
                          ? `${money(-left, currency)} over`
                          : `${money(left, currency)} left`}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="inline-add budget-add">
              <input
                value={bCat}
                placeholder="Category…"
                list="fin-category-hints"
                onChange={(e) => setBCat(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') addBudget()
                }}
              />
              <input
                type="number"
                className="num"
                value={bLimit}
                placeholder="Limit"
                onChange={(e) => setBLimit(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') addBudget()
                }}
              />
              <button onClick={addBudget}>
                <Icon name="plus" size={12} />
              </button>
            </div>
          </Card>
        </div>
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
            <span className="dim" title={moneyExact(planOut, currency)}>
              {money(planOut, currency)}/mo out
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

      {/* The ledger the spending figures are computed from. */}
      <Card
        title="Transactions"
        action={
          transactions.length > 12 ? (
            <button className="ghost" onClick={() => setShowAllTxns((v) => !v)}>
              {showAllTxns ? 'show recent' : `show all ${transactions.length}`}
            </button>
          ) : (
            <span className="dim">{transactions.length ? `${transactions.length} logged` : 'add one below'}</span>
          )
        }
      >
        <div className="txn-add">
          <input
            type="date"
            className="date txn-date"
            value={txn.date}
            onChange={(e) => setTxn((s) => ({ ...s, date: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <input
            className="txn-desc"
            value={txn.desc}
            placeholder="What was it?"
            onChange={(e) => setTxn((s) => ({ ...s, desc: e.target.value }))}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') addTxn()
            }}
          />
          <input
            className="txn-cat"
            value={txn.category}
            placeholder="Category"
            list="fin-category-hints"
            onChange={(e) => setTxn((s) => ({ ...s, category: e.target.value }))}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') addTxn()
            }}
          />
          <button
            className={`toggle ${txn.dir}`}
            title="Money in or out"
            onClick={() => setTxn((s) => ({ ...s, dir: s.dir === 'in' ? 'out' : 'in' }))}
          >
            {txn.dir}
          </button>
          <input
            type="number"
            className="num txn-amount"
            value={txn.amount}
            placeholder="0"
            onChange={(e) => setTxn((s) => ({ ...s, amount: e.target.value }))}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') addTxn()
            }}
          />
          <button className="primary txn-go" onClick={addTxn}>
            <Icon name="plus" size={12} />
          </button>
        </div>

        {transactions.length > 0 && (
          <div className="txn-list">
            {shownTxns.map((t) => (
              <div key={t.id} className={`txn-row dir-${t.direction}`}>
                <input
                  type="date"
                  className="date txn-date"
                  defaultValue={t.date}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => e.target.value && patchTxn(t.id, { date: e.target.value })}
                />
                <input
                  className="txn-desc"
                  defaultValue={t.desc}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => e.target.value.trim() && patchTxn(t.id, { desc: e.target.value.trim() })}
                />
                <input
                  className="txn-cat"
                  defaultValue={t.category ?? ''}
                  placeholder="—"
                  list="fin-category-hints"
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => patchTxn(t.id, { category: e.target.value.trim() || undefined })}
                />
                <button
                  className={`toggle ${t.direction}`}
                  title="Money in or out"
                  onClick={() => patchTxn(t.id, { direction: t.direction === 'in' ? 'out' : 'in' })}
                >
                  {t.direction}
                </button>
                <input
                  type="number"
                  className="num txn-amount"
                  defaultValue={t.amount}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => patchTxn(t.id, { amount: Math.abs(Number(e.target.value) || 0) })}
                />
                <button className="ghost-x" title="Remove" onClick={() => removeTxn(t.id)}>
                  <Icon name="close" size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* What it is all in aid of. */}
      {(goals.length > 0 || legacyTarget > 0) && (
        <Card
          title="Savings goals"
          action={
            goalTargetSum > 0 ? (
              <span className="dim" title={`${moneyExact(goalSavedSum, currency)} of ${moneyExact(goalTargetSum, currency)}`}>
                {money(goalSavedSum, currency)} of {money(goalTargetSum, currency)} saved
              </span>
            ) : undefined
          }
        >
          {legacyTarget > 0 && goals.length === 0 && (
            <div className="blank-inline">
              Legacy savings target: {money(legacyTarget, currency)}. Add named goals below to replace it.
            </div>
          )}
          <div className="sgoal-list">
            {goals.map((g) => {
              const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0
              const done = g.saved >= g.target && g.target > 0
              return (
                <div key={g.id} className={`sgoal${done ? ' done' : ''}`}>
                  <div className="sgoal-head">
                    <input
                      className="sgoal-name"
                      defaultValue={g.name}
                      onKeyDown={(e) => e.stopPropagation()}
                      onBlur={(e) => e.target.value.trim() && patchGoal(g.id, { name: e.target.value.trim() })}
                    />
                    <span className="sgoal-pct">{Math.min(100, Math.round(pct))}%</span>
                    <button className="ghost-x" title="Remove" onClick={() => removeGoal(g.id)}>
                      <Icon name="close" size={11} />
                    </button>
                  </div>
                  <Meter pct={pct} tone={done ? 'up' : undefined} />
                  <div className="sgoal-nums">
                    <input
                      type="number"
                      className="num sgoal-saved"
                      defaultValue={g.saved}
                      onKeyDown={(e) => e.stopPropagation()}
                      onBlur={(e) => patchGoal(g.id, { saved: Math.abs(Number(e.target.value) || 0) })}
                    />
                    <span className="dim">of</span>
                    <input
                      type="number"
                      className="num sgoal-target"
                      defaultValue={g.target}
                      onKeyDown={(e) => e.stopPropagation()}
                      onBlur={(e) => patchGoal(g.id, { target: Math.abs(Number(e.target.value) || 0) })}
                    />
                    {g.target > g.saved && (
                      <span className="dim sgoal-left">{money(g.target - g.saved, currency)} to go</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="inline-add sgoal-add">
            <input
              value={gName}
              placeholder="New goal — house deposit, emergency fund…"
              onChange={(e) => setGName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') addGoal()
              }}
            />
            <input
              type="number"
              className="num"
              value={gTarget}
              placeholder="Target"
              onChange={(e) => setGTarget(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') addGoal()
              }}
            />
            <button onClick={addGoal}>
              <Icon name="plus" size={12} />
            </button>
          </div>
        </Card>
      )}

      {/* Category suggestions shared by every category field on the page. */}
      <datalist id="fin-category-hints">
        {[...new Set([...CATEGORY_HINTS, ...budgets.map((b) => b.category)])].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </Page>
  )
}
