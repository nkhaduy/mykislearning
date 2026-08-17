import { supabase } from './client'

export const login = (email, password) => supabase.auth.signInWithPassword({ email, password })
export const logout = () => supabase.auth.signOut()
export const getSession = () => supabase.auth.getSession()
export const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange(callback)
