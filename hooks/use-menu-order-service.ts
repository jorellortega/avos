"use client"

import { useCallback, useEffect, useState } from "react"

export type MenuServiceMode = "takeout" | "dine-in"

export function useMenuOrderService() {
  const [mode, setModeState] = useState<MenuServiceMode | null>(null)
  const [mesa, setMesaState] = useState("")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const ot = sessionStorage.getItem("orderType")
    const tn = sessionStorage.getItem("tableNumber") ?? ""
    if (ot === "takeout" || ot === "dine-in") {
      setModeState(ot)
    }
    setMesaState(tn)
    setHydrated(true)
  }, [])

  const setMode = useCallback((m: MenuServiceMode) => {
    setModeState(m)
    sessionStorage.setItem("orderType", m)
    if (m === "takeout") {
      sessionStorage.removeItem("tableNumber")
      setMesaState("")
    }
  }, [])

  const setMesa = useCallback((v: string) => {
    setMesaState(v)
    sessionStorage.setItem("tableNumber", v)
  }, [])

  const isComplete =
    mode !== null &&
    (mode === "takeout" || (mode === "dine-in" && mesa.trim() !== ""))

  return { mode, setMode, mesa, setMesa, isComplete, hydrated }
}
