import { supabase } from './client'

export async function saveCourse(course) {
  const { data, error } = await supabase.from('courses').upsert(course).select().single()
  if (error) throw error
  return data
}

export async function createChapter(chapter) {
  const { data, error } = await supabase.from('chapters').insert(chapter).select().single()
  if (error) throw error
  return data
}

export async function createLesson(lesson) {
  const { data, error } = await supabase.from('lessons').insert(lesson).select().single()
  if (error) throw error
  return data
}
