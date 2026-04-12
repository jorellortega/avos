"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { homeHeroSlides, type HeroSlide } from "@/lib/home-hero-slides"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const AUTOPLAY_MS = 5500

type HeroSlideshowProps = {
  slides?: HeroSlide[]
}

export function HeroSlideshow({ slides: slidesProp }: HeroSlideshowProps) {
  const slides = slidesProp?.length ? slidesProp : homeHeroSlides
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback((carousel: CarouselApi) => {
    setCurrent(carousel.selectedScrollSnap())
  }, [])

  useEffect(() => {
    if (!api) return
    onSelect(api)
    api.on("reInit", onSelect)
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api, onSelect])

  useEffect(() => {
    if (!api) return
    const t = window.setInterval(() => {
      api.scrollNext()
    }, AUTOPLAY_MS)
    return () => window.clearInterval(t)
  }, [api])

  return (
    <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "start" }}
        className="w-full h-full"
      >
        <CarouselContent className="-ml-0 h-full">
          {slides.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0 basis-full">
              <div className="relative aspect-square w-full">
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority={slide.id === slides[0]?.id}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2 md:px-3">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto h-9 w-9 rounded-full bg-background/90 shadow-md"
          onClick={() => api?.scrollPrev()}
          aria-label="Imagen anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto h-9 w-9 rounded-full bg-background/90 shadow-md"
          onClick={() => api?.scrollNext()}
          aria-label="Siguiente imagen"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div
        className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5"
        role="tablist"
        aria-label="Seleccionar imagen"
      >
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={current === index}
            aria-label={`Imagen ${index + 1} de ${slides.length}`}
            className={cn(
              "h-2 rounded-full transition-all",
              current === index
                ? "w-6 bg-primary"
                : "w-2 bg-primary/35 hover:bg-primary/55",
            )}
            onClick={() => api?.scrollTo(index)}
          />
        ))}
      </div>
    </div>
  )
}
