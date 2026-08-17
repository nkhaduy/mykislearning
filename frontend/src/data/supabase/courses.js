import { supabase } from './client'

const courseSelect = 'id,title,short_description,description,image_url,published,self_enroll_enabled,category,status,created_at'

export async function listCourses() {
  const { data, error } = await supabase.from('courses').select(courseSelect).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getCourse(id) {
  const { data, error } = await supabase.from('courses').select(courseSelect).eq('id', id).single()
  if (error) throw error
  return data
}

export async function getOutline(courseId) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id,title,sort_order,lessons(id,title,sort_order,is_preview,published)')
    .eq('course_id', courseId)
    .order('sort_order')
    .order('sort_order', { referencedTable: 'lessons' })
  if (error) throw error
  return data ?? []
}

export async function enroll(courseId, profileId) {
  const payload = { id: `${courseId}:${profileId}`, course_id: courseId, account_id: profileId }
  const { data, error } = await supabase.from('enrollments').upsert(payload, { onConflict: 'course_id,account_id' }).select().single()
  if (error) throw error
  return data
}
