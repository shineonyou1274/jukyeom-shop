import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (u) => {
    if (!u) return setProfile(null)
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    setProfile(data)
  }, [])

  useEffect(() => {
    if (!supabase) return setLoading(false)
    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null)
      await loadProfile(data.session?.user)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // 콜백 안에서 바로 supabase를 호출하면 교착될 수 있어 다음 틱으로 미룬다
      setTimeout(() => loadProfile(session?.user), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const value = {
    user,
    profile,
    loading,
    isAdmin: Boolean(profile?.is_admin),
    refreshProfile: () => loadProfile(user),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
