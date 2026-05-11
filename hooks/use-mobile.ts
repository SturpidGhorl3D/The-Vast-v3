import * as React from "react"

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Use pointer coarse (touchscreen) rather than width — stays true in landscape
    const touchMql = window.matchMedia('(pointer: coarse)')
    const widthMql = window.matchMedia('(max-width: 1024px)')
    const check = () => setIsMobile(touchMql.matches && widthMql.matches)
    touchMql.addEventListener('change', check)
    widthMql.addEventListener('change', check)
    check()
    return () => {
      touchMql.removeEventListener('change', check)
      widthMql.removeEventListener('change', check)
    }
  }, [])

  return !!isMobile
}
