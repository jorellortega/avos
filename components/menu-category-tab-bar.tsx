"use client"

import { menuCategoryTabButtonClass } from "@/components/menu-category-tab-styles"

export type MenuCategoryTab = {
  id: string
  label: string
}

type MenuCategoryTabBarProps = {
  value: string
  onValueChange: (id: string) => void
  tabs: MenuCategoryTab[]
  className?: string
}

export function MenuCategoryTabBar({
  value,
  onValueChange,
  tabs,
  className,
}: MenuCategoryTabBarProps) {
  return (
    <div
      data-menu-category-tabs
      role="tablist"
      aria-label="Categorías del menú"
      className={
        className ??
        "mb-4 flex w-full max-w-full flex-nowrap gap-2 overflow-x-auto rounded-2xl bg-secondary/30 p-2 scroll-smooth [scrollbar-width:thin]"
      }
    >
      {tabs.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.id)}
            className={menuCategoryTabButtonClass(active)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
