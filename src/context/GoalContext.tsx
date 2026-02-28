import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type Goal = 'growth' | 'leads'

interface GoalContextValue {
  goal: Goal
  setGoal: (goal: Goal) => void
}

const GoalContext = createContext<GoalContextValue | null>(null)

const STORAGE_KEY = 'insta_insights_goal'

export function GoalProvider({ children }: { children: ReactNode }) {
  const [goal, setGoalState] = useState<Goal>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'leads' ? 'leads' : 'growth'
  })

  const setGoal = (newGoal: Goal) => {
    localStorage.setItem(STORAGE_KEY, newGoal)
    setGoalState(newGoal)
  }

  return (
    <GoalContext.Provider value={{ goal, setGoal }}>
      {children}
    </GoalContext.Provider>
  )
}

export function useGoal() {
  const context = useContext(GoalContext)
  if (!context) throw new Error('useGoal must be used within GoalProvider')
  return context
}
