import type { WorldState } from '@/lib/types'
import { ownedRows } from './map'
import { TABLE_ORDER, spec, type Row, type RowSet, type TableName } from './schema'

export type Op =
  | { kind: 'insert'; table: TableName; rows: Row[] }
  | { kind: 'update'; table: TableName; match: Row; values: Row }
  | { kind: 'delete'; table: TableName; match: Row }

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const pick = (row: Row, cols: string[]) => Object.fromEntries(cols.map((c) => [c, row[c]]))

/**
 * The writes that turn `before` into `after`, in an order the database's foreign keys accept:
 * creates and changes parent-first, removals child-first. Only what each table allows is emitted.
 */
export function diffRows(before: RowSet, after: RowSet): Op[] {
  const ops: Op[] = []
  for (const table of TABLE_ORDER) {
    const s = spec(table)
    const prev = before[table]
    const next = after[table]
    const inserts: Row[] = []
    for (const [key, row] of next) {
      const old = prev.get(key)
      if (!old) {
        if (s.insert) inserts.push(row)
        continue
      }
      const changed = (s.update ?? []).filter((c) => c in row && c in old && !same(row[c], old[c]))
      if (changed.length) ops.push({ kind: 'update', table, match: pick(row, s.pk), values: pick(row, changed) })
    }
    if (inserts.length) ops.push({ kind: 'insert', table, rows: inserts })
  }
  for (const table of [...TABLE_ORDER].reverse()) {
    const s = spec(table)
    if (!s.del) continue
    for (const [key, row] of before[table]) if (!after[table].has(key)) ops.push({ kind: 'delete', table, match: pick(row, s.pk) })
  }
  return ops
}

/** What an action changed for the signed-in member. Signing in or out is never a data change. */
export function cloudChanges(prev: WorldState, next: WorldState, meId: string | null): Op[] {
  if (!meId || prev.accountId !== meId || next.accountId !== meId) return []
  return diffRows(ownedRows(prev), ownedRows(next))
}
