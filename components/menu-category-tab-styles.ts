import { cn } from "@/lib/utils"

/** Selected menu category — solid green (not theme primary / Radix white pill). */
export function menuCategoryTabButtonClass(active: boolean): string {
  return cn(
    "inline-flex shrink-0 snap-start items-center justify-center rounded-full border-2 px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors touch-manipulation",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2",
    active
      ? "border-[#047857] bg-[#059669] text-black font-semibold shadow-md"
      : "border-transparent bg-transparent text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900",
  )
}
