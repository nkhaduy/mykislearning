import { supabase } from './client'

export async function getLesson(id) {
  const { data, error } = await supabase.from('lessons').select('*').eq('id', id).single()
  if (error) throw error
  return data
}
