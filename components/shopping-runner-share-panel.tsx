"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ClipboardCopy, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserSupabase } from "@/lib/supabase/client"
import {
  fullShoppingRunnerListUrl,
  parseRunnerPriceInput,
  parseShoppingRunnerShare,
  shoppingRunnerListPath,
} from "@/lib/shopping-runner-list"

export function ShoppingRunnerSharePanel() {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [token, setToken] = useState<string | null>(null)
  const [budgetText, setBudgetText] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc("staff_get_shopping_runner_share")
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    const parsed = parseShoppingRunnerShare(data)
    if (!parsed) {
      setError("No se pudo cargar el enlace.")
      return
    }
    setToken(parsed.shareToken)
    setBudgetText(parsed.cashBudget > 0 ? parsed.cashBudget.toFixed(2) : "")
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const copyLink = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(fullShoppingRunnerListUrl(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("No se pudo copiar.")
    }
  }

  const saveBudget = async () => {
    const amount = parseRunnerPriceInput(budgetText)
    if (amount == null) {
      setError("Monto inválido.")
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase.rpc(
      "staff_set_shopping_runner_budget",
      { p_amount: amount },
    )
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    const parsed = parseShoppingRunnerShare(data)
    if (parsed) {
      setToken(parsed.shareToken)
      setBudgetText(parsed.cashBudget.toFixed(2))
    }
  }

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Cargando enlace runner…
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">Enlace para runner</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comparte{" "}
          <Link href={token ? shoppingRunnerListPath(token) : "/lista-compras"} className="underline">
            /lista-compras
          </Link>
          . Sin cuenta: lista numerada, checkmarks y precios.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Copiado
            </>
          ) : (
            <>
              <ClipboardCopy className="h-4 w-4 mr-1" />
              Copiar enlace
            </>
          )}
        </Button>
        {token ? (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href={shoppingRunnerListPath(token)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Abrir
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="runner-share-budget" className="text-xs">
            Efectivo para runner (MXN)
          </Label>
          <div className="relative w-[8.5rem]">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              id="runner-share-budget"
              className="h-8 pl-6 tabular-nums"
              value={budgetText}
              disabled={saving}
              onChange={(e) => setBudgetText(e.target.value)}
              onBlur={() => void saveBudget()}
              placeholder="0.00"
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={saving}
          onClick={() => void saveBudget()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar efectivo"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
