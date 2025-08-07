// components/Icons.tsx
import React, { useState, useEffect, useRef } from 'react'


export const ArrowDownIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 14l-7 7m0 0l-7-7m7 7V3"
    />
  </svg>
)

export const XIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
)

export const SunIcon = () => (
  <svg
    className="w-3 h-3 text-white"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
    />
  </svg>
)

export const MoonIcon = () => (
  <svg
    className="w-3 h-3 text-white"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
    />
  </svg>
)

export const UserIcon = () => (
  <svg
    className="w-4 h-4"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
    />
  </svg>
)

export const TabsIcon = () => (
  <svg
    className="w-3 h-3 mr-1"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
)

export const CloseIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
)

export const SendIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </svg>
)

export const SettingsIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 
         2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 
         2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 
         1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 
         0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 
         2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
)

export const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
)

export const ChevronUpIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  </svg>
)

// used in MessageList
export const AnimatedPawPrints = ({
  delay = 9000,
  speed = 4,
  opacity = 0.3
}: {
  delay?: number
  speed?: number
  opacity?: number
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [fadeOutProgress, setFadeOutProgress] = useState(0) // 0 = not fading, 1 = fully faded

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let fadeOutInterval: ReturnType<typeof setInterval>

    const start = () => {
      setIsRunning(true)
      setFadeOutProgress(0)

      // Start fade-out after `speed` seconds
      setTimeout(() => {
        const startTime = Date.now()
        const fadeOutDuration = 1500 // 1.5 seconds
        
        // Update fade-out progress every 16ms (60fps)
        fadeOutInterval = setInterval(() => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(1, elapsed / fadeOutDuration)
          setFadeOutProgress(progress)
          
          if (progress >= 1) {
            clearInterval(fadeOutInterval)
            setIsRunning(false)
            
            // Wait for `delay` before starting the next cycle
            timer = setTimeout(start, delay)
          }
        }, 16)
      }, speed * 1000)
    }

    // Initial delay before first run
    timer = setTimeout(start, delay)

    return () => {
      clearTimeout(timer)
      clearInterval(fadeOutInterval)
    }
  }, [delay, speed])

  if (!isRunning) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {[...Array(8)].map((_, step) => {
        const isLeft = step % 2 === 0
        const size = 28 - step * 1.8
        const delay = step * 0.3
        const x = -50 + step * 18
        const y = 80 - step * 10 + (isLeft ? -8 : 8)

        // Calculate fade-out opacity
        let currentOpacity = opacity * (1 - step * 0.04)
        if (fadeOutProgress > 0) {
          currentOpacity *= (1 - fadeOutProgress)
        }

        return (
          <div
            key={step}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity: currentOpacity,
              animation: `paw-run-across-diagonal ${speed}s ease-in-out ${delay}s forwards`,
              transform: `rotate(${isLeft ? -5 : 5}deg)`
            }}
          >
            <PawIcon variant="brand" />
          </div>
        )
      })}
    </div>
  )
}
// used in bottom of chat input (going to move location probably)
export const LoadingPawTrail = () => {
  const [visibleSteps, setVisibleSteps] = useState<Array<{ step: number; id: string }>>([])
  const animationCounterRef = useRef(0)

  useEffect(() => {
    const animate = () => {
      setVisibleSteps([])
      animationCounterRef.current += 1
      const currentCounter = animationCounterRef.current
      
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          setVisibleSteps(prev => [...prev, { step: i, id: `${currentCounter}-${i}` }])
        }, i * 200)
      }
      setTimeout(() => {
        setVisibleSteps([])
        setTimeout(animate, 500)
      }, 1500)
    }
    animate()
  }, [])

  return (
    <div className="relative inline-flex items-center h-4 w-12">
      {visibleSteps.map(({ step, id }) => {
        const size = 8 - step * 1.5
        const left = `${step * 12}px`
        const opacity = 1 - step * 0.3

        return (
          <div
            key={id}
            className="absolute"
            style={{
              left,
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              animation: 'paw-fade-in 0.3s ease-out'
            }}
          >
            <PawIcon variant="default" />
          </div>
        )
      })}
    </div>
  )
}
// used in AnimatedPawPrints and LoadingPawTrail
export const PawIcon = ({ variant = 'default' }: { variant?: 'brand' | 'default' }) => (
  <svg
    fill={variant === 'brand' ? 'hsl(var(--brand))' : 'currentColor'}
    viewBox="0 0 24 24"
    className="w-full h-full"
    aria-hidden="true"
  >
    <path d="M19.5 18c1 1.6 1.5 2.4 1.5 3.3 0 1.7-1.3 2.6-3 2.6-.8 0-1.3 0-2.5-.6-.8-.7-2.7-.7-2.7-.7-.8 0-1.9.7-2.7.7-1.3.6-1.7.6-2.5.6-1.7 0-3-1-3-2.6 0-.9.5-1.7 1.5-3.3 1.9-3.2 3.6-4.7 3.6-4.7.5 0 1.2 0 2.7 0s2.2 0 2.7 0c1.9 1.5 3.9 4.7 3.9 4.7zm-3.9-7.5c1.8 0 3.3-2.3 3.3-5.2S17.4 0 15.6 0s-3.3 2.3-3.3 5.2 1.5 5.2 3.3 5.2zm-8.1 0c1.8 0 3.3-2.3 3.3-5.2S9.3 0 7.5 0 4.2 2.3 4.2 5.2s1.5 5.2 3.3 5.2zm-4.2 5.2c1.3-.6 1.6-2.8.7-4.9S2 8.3.7 8.9s-1.6 2.8-.7 4.9 2.8 1.7 4.2 1.1zm12.3 0c1.3.6 3.2-.5 4.2-1.1s1.6-2.8.7-4.9-2.9-2.2-4.2-1.6-1.6 2.8-.7 4.9z" />
  </svg>
)

// Icons from Header.tsx and HelpSection.tsx
export const HelpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export const PauseIcon = () => (
  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
  </svg>
)

export const ResetIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

export const MonitorIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
)

export const PauseIconFilled = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
  </svg>
)

export const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 3v5h-5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H3v5" />
  </svg>
)

export const ExternalLinkIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

export const GitHubIcon = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.1 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.09.16 1.9.08 2.1.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
)




