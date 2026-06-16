'use client'

import { useState, useTransition } from 'react'
import { saveCompanyRule, deleteCompanyRule } from './actions'

type Rule = {
  id: string
  rule_name: string
  match_type: string
  conditions: { field: string; operator: string; value: string }[]
  gl_account_id: string | null
  priority: number
}

type Account = { qb_account_id: string; name: string | null }

const OPERATORS = ['contains', 'equals', 'begins with', 'ends with']
const FIELDS = ['Description', 'Unit Price']

export function CompanyRulesClient({
  rules: initialRules,
  accounts,
}: {
  rules: Rule[]
  accounts: Account[]
}) {
  const [list, setList] = useState(initialRules)
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [newRule, setNewRule] = useState({
    rule_name: '',
    match_type: 'all',
    conditions: [{ field: 'Description', operator: 'contains', value: '' }],
    gl_account_id: '',
  })

  const getAccountName = (id: string | null) =>
    id ? (accounts.find(a => a.qb_account_id === id)?.name ?? id) : '—'

  const handleSave = () => {
    if (!newRule.rule_name || !newRule.gl_account_id) return
    startTransition(async () => {
      const saved = await saveCompanyRule(newRule)
      if (saved) {
        setList(l => [...l, saved as Rule])
        setAdding(false)
        setNewRule({ rule_name: '', match_type: 'all', conditions: [{ field: 'Description', operator: 'contains', value: '' }], gl_account_id: '' })
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteCompanyRule(id)
      setList(l => l.filter(r => r.id !== id))
    })
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Company rules automatically assign GL accounts to line items across all vendors based on description text or unit price.
        They apply as a default when no vendor-specific rule or stored mapping matches — vendor rules always take priority.
        Use these for patterns that apply everywhere, like <em>tax lines</em> or <em>freight charges</em>.
      </p>

      {list.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
          No GL account rules yet. Add one below.
        </p>
      )}

      {list.length > 0 && (
        <div className="space-y-3 mb-5">
          {list.map(rule => (
            <div key={rule.id} style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '12px 16px' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{rule.rule_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    When {rule.match_type === 'all' ? 'ALL' : 'ANY'} of:
                    {(rule.conditions as { field: string; operator: string; value: string }[]).map((c, i) => (
                      <span key={i}> {c.field} {c.operator} &quot;{c.value}&quot;{i < rule.conditions.length - 1 ? ',' : ''}</span>
                    ))}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    → {getAccountName(rule.gl_account_id)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={isPending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', fontSize: 12, flexShrink: 0 }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          style={{
            background: 'white', color: '#2DB87A',
            border: '0.5px solid #2DB87A',
            borderRadius: 6, padding: '7px 16px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          + Add Rule
        </button>
      ) : (
        <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, padding: '16px' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>New Rule</p>

          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Rule name</label>
              <input
                value={newRule.rule_name}
                onChange={e => setNewRule(r => ({ ...r, rule_name: e.target.value }))}
                placeholder="e.g. Tax lines, Freight charges"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Match type</label>
              <select value={newRule.match_type} onChange={e => setNewRule(r => ({ ...r, match_type: e.target.value }))} style={inputStyle}>
                <option value="all">ALL conditions must match</option>
                <option value="any">ANY condition can match</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Conditions</label>
              {newRule.conditions.map((cond, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select value={cond.field} onChange={e => {
                    const c = [...newRule.conditions]; c[i] = { ...c[i], field: e.target.value }; setNewRule(r => ({ ...r, conditions: c }))
                  }} style={{ ...inputStyle, width: 'auto', flex: '0 0 120px' }}>
                    {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={cond.operator} onChange={e => {
                    const c = [...newRule.conditions]; c[i] = { ...c[i], operator: e.target.value }; setNewRule(r => ({ ...r, conditions: c }))
                  }} style={{ ...inputStyle, width: 'auto', flex: '0 0 110px' }}>
                    {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input
                    value={cond.value}
                    onChange={e => {
                      const c = [...newRule.conditions]; c[i] = { ...c[i], value: e.target.value }; setNewRule(r => ({ ...r, conditions: c }))
                    }}
                    placeholder="value"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {newRule.conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setNewRule(r => ({ ...r, conditions: r.conditions.filter((_, j) => j !== i) }))}
                      style={{ fontSize: 11, color: '#991B1B', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setNewRule(r => ({ ...r, conditions: [...r.conditions, { field: 'Description', operator: 'contains', value: '' }] }))}
                style={{ fontSize: 11, color: '#2DB87A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                + Add condition
              </button>
            </div>

            <div>
              <label style={labelStyle}>Assign to GL account</label>
              <select value={newRule.gl_account_id} onChange={e => setNewRule(r => ({ ...r, gl_account_id: e.target.value }))} style={inputStyle}>
                <option value="">— Select GL account —</option>
                {accounts.map(a => <option key={a.qb_account_id} value={a.qb_account_id}>{a.name}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending || !newRule.rule_name || !newRule.gl_account_id}
                style={{
                  background: '#2DB87A', color: 'white',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  opacity: isPending || !newRule.rule_name || !newRule.gl_account_id ? 0.5 : 1,
                }}
              >
                Save Rule
              </button>
              <button
                onClick={() => setAdding(false)}
                style={{ background: 'white', color: 'var(--color-text-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36,
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 6, padding: '0 10px',
  fontSize: 13, color: 'var(--color-text-primary)',
  background: 'white',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500,
  color: 'var(--color-text-secondary)',
  display: 'block', marginBottom: 4,
}
