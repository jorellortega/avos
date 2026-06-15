"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Check, ClipboardCopy, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  computeRunnerListChange,
  computeRunnerOtherSpend,
  computeRunnerSpent,
  formatRunnerMoney,
  parseRunnerPriceInput,
  parseShoppingRunnerPublic,
  parseShoppingRunnerShare,
  SHOPPING_RUNNER_LIST_REFRESH_MS,
  type ShoppingRunnerItem,
  type ShoppingRunnerPublic,
  shoppingRunnerListPath,
} from "@/lib/shopping-runner-list"
import { cn } from "@/lib/utils"

type ListaComprasClientProps = {
  token: string | null
  canEditBudget: boolean
  canManageRunnerHidden?: boolean
}

function priceText(amount: number | null): string {
  if (amount == null || amount <= 0) return ""
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2)
}

export function ListaComprasClient({
  token,
  canEditBudget,
  canManageRunnerHidden = false,
}: ListaComprasClientProps) {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [data, setData] = useState<ShoppingRunnerPublic | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(token)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)
  const [budgetText, setBudgetText] = useState("")
  const [savingBudget, setSavingBudget] = useState(false)
  const [copied, setCopied] = useState(false)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [changeLeftDraft, setChangeLeftDraft] = useState("")
  const [notesDraft, setNotesDraft] = useState("")
  const [savingCompletion, setSavingCompletion] = useState(false)
  const [hideBusyId, setHideBusyId] = useState<string | null>(null)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadList = useCallback(
    async (
      activeToken: string,
      options?: { includeHidden?: boolean; silent?: boolean },
    ) => {
      const includeHidden = options?.includeHidden ?? canManageRunnerHidden
      const silent = options?.silent ?? false
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      const { data: raw, error: err } = await supabase.rpc(
        "get_shopping_runner_public",
        {
          p_token: activeToken,
          p_include_hidden: includeHidden,
        },
      )
      if (!silent) setLoading(false)
      if (err) {
        if (!silent) {
          setError(
            err.message.includes("invalid token")
              ? "Enlace inválido o expirado. Pide uno nuevo al equipo."
              : err.message,
          )
          setData(null)
        }
        return
      }
      const parsed = parseShoppingRunnerPublic(raw)
      if (!parsed) {
        if (!silent) setError("No se pudo cargar la lista.")
        return
      }
      setData(parsed)
      if (!silent) {
        setBudgetText(parsed.cashBudget > 0 ? parsed.cashBudget.toFixed(2) : "")
        setChangeLeftDraft(priceText(parsed.changeLeft))
        setNotesDraft(parsed.completionNotes ?? "")
      } else if (!canEditBudget) {
        setBudgetText(parsed.cashBudget > 0 ? parsed.cashBudget.toFixed(2) : "")
      }
      setPriceDrafts((prev) => {
        const next = { ...prev }
        for (const row of parsed.items) {
          if (!(row.id in next)) {
            next[row.id] = priceText(row.paidAmount)
          } else if (!silent && row.paidAmount != null) {
            next[row.id] = priceText(row.paidAmount)
          }
        }
        return next
      })
    },
    [supabase, canManageRunnerHidden, canEditBudget],
  )

  const loadStaffShare = useCallback(async () => {
    const { data: raw, error: err } = await supabase.rpc(
      "staff_get_shopping_runner_share",
    )
    if (err) return null
    return parseShoppingRunnerShare(raw)
  }, [supabase])

  useEffect(() => {
    if (token) {
      setShareToken(token)
      void loadList(token)
      return
    }
    if (!canEditBudget) {
      setLoading(false)
      return
    }
    void (async () => {
      setLoading(true)
      const share = await loadStaffShare()
      setLoading(false)
      if (share) {
        setShareToken(share.shareToken)
        setBudgetText(share.cashBudget > 0 ? share.cashBudget.toFixed(2) : "")
        await loadList(share.shareToken)
      }
    })()
  }, [token, canEditBudget, loadList, loadStaffShare])

  useEffect(() => {
    if (!shareToken) return
    const timer = window.setInterval(() => {
      void loadList(shareToken, { silent: true })
    }, SHOPPING_RUNNER_LIST_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [shareToken, loadList])

  const spent = useMemo(
    () => (data ? computeRunnerSpent(data.items) : 0),
    [data],
  )
  const budget = data?.cashBudget ?? 0
  const listChange = computeRunnerListChange(budget, spent)
  const changeLeft = data?.changeLeft ?? null
  const otherSpend = computeRunnerOtherSpend(budget, spent, changeLeft)
  const runnerVisibleCount = useMemo(
    () => data?.items.filter((row) => !row.runnerHidden).length ?? 0,
    [data],
  )
  const hiddenCount = useMemo(
    () => data?.items.filter((row) => row.runnerHidden).length ?? 0,
    [data],
  )
  const canEditCompletion = Boolean(shareToken && data)

  const shareUrl = useMemo(() => {
    if (!shareToken || typeof window === "undefined") return ""
    return `${window.location.origin}${shoppingRunnerListPath(shareToken)}`
  }, [shareToken])

  const patchItem = useCallback(
    async (
      item: ShoppingRunnerItem,
      patch: { checked?: boolean; paidAmount?: number | null },
    ) => {
      if (!shareToken) return
      const checked = patch.checked ?? item.checked
      const paidAmount =
        patch.paidAmount !== undefined ? patch.paidAmount : item.paidAmount

      const { data: raw, error: err } = await supabase.rpc(
        "runner_patch_shopping_item",
        {
          p_token: shareToken,
          p_item_id: item.id,
          p_checked: checked,
          p_paid_amount: paidAmount,
        },
      )
      if (err) {
        setError(err.message)
        return
      }
      const parsed = parseShoppingRunnerPublic(raw)
      if (parsed) setData(parsed)
    },
    [shareToken, supabase],
  )

  const schedulePatch = useCallback(
    (item: ShoppingRunnerItem, patch: { checked?: boolean; paidAmount?: number | null }) => {
      const key = item.id
      const existing = saveTimers.current.get(key)
      if (existing) clearTimeout(existing)
      saveTimers.current.set(
        key,
        setTimeout(() => {
          saveTimers.current.delete(key)
          void patchItem(item, patch)
        }, 350),
      )
    },
    [patchItem],
  )

  const saveCompletion = useCallback(
    async (changeLeftValue: number | null, notesValue: string) => {
      if (!shareToken) return
      setSavingCompletion(true)
      setError(null)
      const { data: raw, error: err } = await supabase.rpc(
        "runner_patch_shopping_completion",
        {
          p_token: shareToken,
          p_change_left: changeLeftValue,
          p_notes: notesValue.trim() || null,
        },
      )
      setSavingCompletion(false)
      if (err) {
        setError(err.message)
        return
      }
      const parsed = parseShoppingRunnerPublic(raw)
      if (parsed) {
        setData(parsed)
        setChangeLeftDraft(priceText(parsed.changeLeft))
        setNotesDraft(parsed.completionNotes ?? "")
      }
    },
    [shareToken, supabase],
  )

  const scheduleCompletionSave = useCallback(
    (changeLeftValue: number | null, notesValue: string) => {
      if (!canEditCompletion) return
      if (completionTimer.current) clearTimeout(completionTimer.current)
      completionTimer.current = setTimeout(() => {
        completionTimer.current = null
        void saveCompletion(changeLeftValue, notesValue)
      }, 400)
    },
    [canEditCompletion, saveCompletion],
  )

  const toggleRunnerHidden = useCallback(
    async (item: ShoppingRunnerItem, hidden: boolean) => {
      if (!canManageRunnerHidden || !shareToken) return
      setHideBusyId(item.id)
      setError(null)
      const { error: err } = await supabase.rpc(
        "manager_set_shopping_runner_hidden",
        {
          p_item_id: item.id,
          p_hidden: hidden,
        },
      )
      setHideBusyId(null)
      if (err) {
        setError(err.message)
        return
      }
      await loadList(shareToken, { includeHidden: true })
    },
    [canManageRunnerHidden, shareToken, supabase, loadList],
  )

  const saveBudget = async () => {
    const parsed = parseRunnerPriceInput(budgetText)
    if (parsed == null) {
      setError("Pon un monto válido para el efectivo.")
      return
    }
    setSavingBudget(true)
    setError(null)
    const { data: raw, error: err } = await supabase.rpc(
      "staff_set_shopping_runner_budget",
      { p_amount: parsed },
    )
    setSavingBudget(false)
    if (err) {
      setError(err.message)
      return
    }
    const share = parseShoppingRunnerShare(raw)
    if (share) {
      setShareToken(share.shareToken)
      setBudgetText(share.cashBudget.toFixed(2))
      if (shareToken) await loadList(share.shareToken)
    }
  }

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("No se pudo copiar el enlace.")
    }
  }

  if (!token && !canEditBudget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lista de compras</CardTitle>
          <CardDescription>
            Necesitas el enlace que te manda el equipo (incluye un código al final).
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle style={{ fontFamily: "var(--font-heading)" }}>
            Lista de compras
          </CardTitle>
          <CardDescription>
            Marca lo que compraste y pon el precio. El total se suma abajo. La lista
            se actualiza sola cada 5 minutos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div className="space-y-1 min-w-[10rem] flex-1">
                <Label htmlFor="runner-budget">
                  {canEditBudget ? "Efectivo para el runner" : "Te dieron"}
                </Label>
                {canEditBudget ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1 max-w-[10rem]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        id="runner-budget"
                        type="text"
                        inputMode="decimal"
                        className="pl-7 tabular-nums"
                        value={budgetText}
                        disabled={savingBudget}
                        onChange={(e) => setBudgetText(e.target.value)}
                        onBlur={() => void saveBudget()}
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={savingBudget}
                      onClick={() => void saveBudget()}
                    >
                      {savingBudget ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Guardar"
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-2xl font-bold tabular-nums text-primary">
                    {formatRunnerMoney(budget)}
                  </p>
                )}
              </div>
              <div className="text-sm space-y-0.5 tabular-nums">
                <p>
                  Gastado (lista):{" "}
                  <span className="font-semibold">{formatRunnerMoney(spent)}</span>
                </p>
                <p className="text-muted-foreground">
                  Cambio según lista:{" "}
                  <span className="font-semibold">{formatRunnerMoney(listChange)}</span>
                </p>
                {changeLeft != null ? (
                  <p>
                    Cambio que traes:{" "}
                    <span className="font-semibold">{formatRunnerMoney(changeLeft)}</span>
                  </p>
                ) : null}
                {otherSpend != null ? (
                  <p
                    className={cn(
                      Math.abs(otherSpend) < 0.01
                        ? "text-green-700 dark:text-green-400"
                        : otherSpend > 0
                          ? "text-amber-700 dark:text-amber-400 font-medium"
                          : "text-destructive font-medium",
                    )}
                  >
                    {Math.abs(otherSpend) < 0.01
                      ? "Cuadra con la lista"
                      : otherSpend > 0
                        ? `Otro gasto: ${formatRunnerMoney(otherSpend)}`
                        : `Faltan ${formatRunnerMoney(Math.abs(otherSpend))} en precios`}
                  </p>
                ) : null}
              </div>
            </div>

            {canManageRunnerHidden && hiddenCount > 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {hiddenCount} artículo{hiddenCount === 1 ? "" : "s"} oculto
                {hiddenCount === 1 ? "" : "s"} al runner — solo tú los ves aquí.
              </p>
            ) : null}

            {canEditBudget && shareUrl ? (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/70">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="h-4 w-4 mr-1" />
                      Copiar enlace para runner
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loading || !shareToken}
                  onClick={() => shareToken && void loadList(shareToken)}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                  Actualizar lista
                </Button>
              </div>
            ) : null}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading && !data ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando lista…
            </p>
          ) : null}

          {data && runnerVisibleCount === 0 && hiddenCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nada pendiente en lista de compras.
            </p>
          ) : null}

          {data && runnerVisibleCount === 0 && hiddenCount > 0 && canManageRunnerHidden ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Todo está oculto al runner ({hiddenCount} artículo
              {hiddenCount === 1 ? "" : "s"}). Usa «Mostrar al runner» abajo para
              publicar de nuevo.
            </p>
          ) : null}

          {data && data.items.length > 0 ? (
            <ol className="space-y-3 list-none counter-reset-none">
              {(() => {
                let visibleNum = 0
                return data.items.map((row) => {
                  const listNum = row.runnerHidden ? null : ++visibleNum
                  const rowBusy = hideBusyId === row.id
                  const rowDisabled = row.runnerHidden
                  return (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-lg border p-3 flex gap-3 items-start",
                    row.checked && !row.runnerHidden && "bg-muted/30",
                    row.runnerHidden &&
                      "border-dashed border-amber-500/40 bg-amber-500/5 opacity-90",
                  )}
                >
                  <span className="text-sm font-bold text-muted-foreground w-6 shrink-0 pt-1 tabular-nums">
                    {listNum != null ? `${listNum}.` : "—"}
                  </span>
                  <Checkbox
                    checked={row.checked}
                    disabled={rowDisabled}
                    className="mt-1 shrink-0"
                    onCheckedChange={(checked) => {
                      if (rowDisabled) return
                      const nextChecked = checked === true
                      setData((prev) =>
                        prev
                          ? {
                              ...prev,
                              items: prev.items.map((i) =>
                                i.id === row.id
                                  ? { ...i, checked: nextChecked }
                                  : i,
                              ),
                            }
                          : prev,
                      )
                      void patchItem(row, { checked: nextChecked })
                    }}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "font-medium leading-snug",
                            row.checked &&
                              !row.runnerHidden &&
                              "line-through text-muted-foreground",
                            row.runnerHidden && "text-muted-foreground",
                          )}
                        >
                          {row.name}
                        </p>
                        {row.runnerHidden ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 px-2 py-0.5">
                            Oculto al runner
                          </span>
                        ) : null}
                      </div>
                      {row.buyLabel ? (
                        <p className="text-xs text-muted-foreground">
                          Comprar: {row.buyLabel}
                        </p>
                      ) : null}
                      {row.detail ? (
                        <p className="text-xs text-muted-foreground">{row.detail}</p>
                      ) : null}
                    </div>
                    {!rowDisabled ? (
                      <div className="flex items-center gap-2 max-w-[11rem]">
                        <Label htmlFor={`price-${row.id}`} className="sr-only">
                          Precio {row.name}
                        </Label>
                        <span className="text-sm text-muted-foreground shrink-0">$</span>
                        <Input
                          id={`price-${row.id}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="h-9 tabular-nums"
                          value={priceDrafts[row.id] ?? priceText(row.paidAmount)}
                          onChange={(e) => {
                            const v = e.target.value
                            setPriceDrafts((prev) => ({ ...prev, [row.id]: v }))
                            const parsed = parseRunnerPriceInput(v)
                            setData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    items: prev.items.map((i) =>
                                      i.id === row.id
                                        ? {
                                            ...i,
                                            paidAmount: parsed,
                                            checked:
                                              parsed != null && parsed > 0
                                                ? true
                                                : i.checked,
                                          }
                                        : i,
                                    ),
                                  }
                                : prev,
                            )
                            schedulePatch(row, {
                              paidAmount: parsed,
                              checked:
                                parsed != null && parsed > 0 ? true : row.checked,
                            })
                          }}
                          onBlur={() => {
                            const parsed = parseRunnerPriceInput(
                              priceDrafts[row.id] ?? "",
                            )
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [row.id]: priceText(parsed),
                            }))
                          }}
                        />
                      </div>
                    ) : null}
                    {canManageRunnerHidden ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={row.runnerHidden ? "secondary" : "outline"}
                        className="h-8"
                        disabled={rowBusy}
                        onClick={() =>
                          void toggleRunnerHidden(row, !row.runnerHidden)
                        }
                      >
                        {rowBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : row.runnerHidden ? (
                          <>
                            <Eye className="h-4 w-4 mr-1" />
                            Mostrar al runner
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-4 w-4 mr-1" />
                            Ocultar al runner
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </li>
                  )
                })
              })()}
            </ol>
          ) : null}

          {data && runnerVisibleCount > 0 ? (
            <div className="border-t pt-4 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total comprado</span>
              <span className="text-lg font-bold tabular-nums">
                {formatRunnerMoney(spent)}
              </span>
            </div>
          ) : null}

          {data ? (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Al terminar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cuenta el efectivo que te queda. Si gastaste en otra cosa, pon el cambio real —
                  aquí se calcula la diferencia.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="runner-change-left">Cambio que traes</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative max-w-[10rem]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      id="runner-change-left"
                      type="text"
                      inputMode="decimal"
                      className="pl-7 tabular-nums"
                      placeholder={priceText(listChange) || "0.00"}
                      value={changeLeftDraft}
                      disabled={!canEditCompletion || savingCompletion}
                      onChange={(e) => {
                        const v = e.target.value
                        setChangeLeftDraft(v)
                        const parsed = parseRunnerPriceInput(v)
                        setData((prev) =>
                          prev ? { ...prev, changeLeft: parsed } : prev,
                        )
                        scheduleCompletionSave(parsed, notesDraft)
                      }}
                      onBlur={() => {
                        const parsed = parseRunnerPriceInput(changeLeftDraft)
                        setChangeLeftDraft(priceText(parsed))
                        void saveCompletion(parsed, notesDraft)
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Según lista: {formatRunnerMoney(listChange)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="runner-completion-notes">Notas</Label>
                <Textarea
                  id="runner-completion-notes"
                  rows={3}
                  placeholder="Ej. compré bolsas en la tienda, ticket en la bolsa…"
                  value={notesDraft}
                  disabled={!canEditCompletion || savingCompletion}
                  onChange={(e) => {
                    const v = e.target.value
                    setNotesDraft(v)
                    setData((prev) =>
                      prev ? { ...prev, completionNotes: v.trim() || null } : prev,
                    )
                    scheduleCompletionSave(
                      parseRunnerPriceInput(changeLeftDraft),
                      v,
                    )
                  }}
                  onBlur={() =>
                    void saveCompletion(
                      parseRunnerPriceInput(changeLeftDraft),
                      notesDraft,
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!canEditCompletion || savingCompletion}
                  onClick={() =>
                    void saveCompletion(
                      parseRunnerPriceInput(changeLeftDraft),
                      notesDraft,
                    )
                  }
                >
                  {savingCompletion ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Guardar notas"
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canEditBudget ? (
        <p className="text-xs text-muted-foreground text-center">
          <Link href="/inventario-edit" className="underline underline-offset-2">
            Inventario
          </Link>
          {" · "}
          <Link href="/staff/dashboard" className="underline underline-offset-2">
            Panel staff
          </Link>
        </p>
      ) : null}
    </div>
  )
}
