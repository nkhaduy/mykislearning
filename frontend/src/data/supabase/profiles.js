import { supabase } from './client'

export async function getMyProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authData.user.id)
    .single()
  if (error) throw error
  return data
}
