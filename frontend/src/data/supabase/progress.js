import { supabase } from './client'

export async function getProgress(courseId) {
  const { data, error } = await supabase.from('lesson_progress').select('*').eq('course_id', courseId)
  if (error) throw error
  return data ?? []
}

export async function setLessonComplete({ lessonId, courseId, userId, completed }) {
  const { data, error } = await supabase.from('lesson_progress').upsert({
    lesson_id: lessonId,
    course_id: courseId,
    user_id: userId,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  }, { onConflict: 'lesson_id,user_id' }).select().single()
  if (error) throw error
  return data
}
