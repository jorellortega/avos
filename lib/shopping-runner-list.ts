export type ShoppingRunnerItem = {
  id: string
  name: string
  detail: string | null
  buyLabel: string | null
  checked: boolean
  paidAmount: number | null
  sortOrder: number
  runnerHidden: boolean
}

export type ShoppingRunnerPublic = {
  cashBudget: number
  spentTotal: number
  changeLeft: number | null
  completionNotes: string | null
  items: ShoppingRunnerItem[]
}

export type ShoppingRunnerShare = {
  shareToken: string
  cashBudget: number
}

export function parseShoppingRunnerPublic(raw: unknown): ShoppingRunnerPublic | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const cashBudget = Number(o.cash_budget)
  const spentTotal = Number(o.spent_total)
  const changeRaw = o.change_left
  const changeLeft =
    changeRaw == null || changeRaw === ""
      ? null
      : Number.isFinite(Number(changeRaw))
        ? Number(changeRaw)
        : null
  const completionNotes =
    typeof o.completion_notes === "string" && o.completion_notes.trim()
      ? o.completion_notes.trim()
      : null
  const itemsRaw = o.items
  const items: ShoppingRunnerItem[] = []
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object") continue
      const r = row as Record<string, unknown>
      const id = typeof r.id === "string" ? r.id : ""
      const name = typeof r.name === "string" ? r.name : ""
      if (!id || !name.trim()) continue
      const paid = r.paid_amount
      items.push({
        id,
        name: name.trim(),
        detail:
          typeof r.detail === "string" && r.detail.trim()
            ? r.detail.trim()
            : null,
        buyLabel:
          typeof r.buy_label === "string" && r.buy_label.trim()
            ? r.buy_label.trim()
            : null,
        checked: r.checked === true,
        paidAmount:
          paid == null || paid === ""
            ? null
            : Number.isFinite(Number(paid))
              ? Number(paid)
              : null,
        sortOrder: Number(r.sort_order) || 0,
        runnerHidden: r.runner_hidden === true,
      })
    }
  }
  return {
    cashBudget: Number.isFinite(cashBudget) ? cashBudget : 0,
    spentTotal: Number.isFinite(spentTotal) ? spentTotal : 0,
    changeLeft,
    completionNotes,
    items,
  }
}

export function parseShoppingRunnerShare(raw: unknown): ShoppingRunnerShare | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const shareToken =
    typeof o.share_token === "string" ? o.share_token.trim() : ""
  const cashBudget = Number(o.cash_budget)
  if (!shareToken) return null
  return {
    shareToken,
    cashBudget: Number.isFinite(cashBudget) ? cashBudget : 0,
  }
}

export function formatRunnerMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n)
}

export function shoppingRunnerListPath(token: string): string {
  const t = token.trim()
  return t ? `/lista-compras?t=${encodeURIComponent(t)}` : "/lista-compras"
}

/** Background poll while runner is shopping (new items from inventario). */
export const SHOPPING_RUNNER_LIST_REFRESH_MS = 5 * 60 * 1000

export function computeRunnerSpent(items: ShoppingRunnerItem[]): number {
  return items.reduce((sum, row) => {
    if (row.runnerHidden || !row.checked || row.paidAmount == null) return sum
    return sum + row.paidAmount
  }, 0)
}

/** Budget minus list spend minus change runner actually brings back. */
export function computeRunnerOtherSpend(
  budget: number,
  spentOnList: number,
  changeLeft: number | null,
): number | null {
  if (changeLeft == null) return null
  return Math.round((budget - spentOnList - changeLeft) * 100) / 100
}

export function computeRunnerListChange(budget: number, spentOnList: number): number {
  return Math.round((budget - spentOnList) * 100) / 100
}

export function parseRunnerPriceInput(raw: string): number | null {
  const t = raw.trim().replace(/[$,\s]/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}
