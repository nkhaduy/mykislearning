<template>
  <div class="lesson-page" v-if="lesson"><RouterLink :to="`/courses/${route.params.courseId}`" class="back">← Course outline</RouterLink><article><p class="eyebrow">LESSON</p><h1>{{ lesson.title }}</h1><div class="lesson-content" v-html="html"></div><Button variant="solid" theme="gray" @click="complete" :loading="saving">{{ done ? 'Completed' : 'Mark complete' }}</Button></article></div>
</template>
<script setup>
import { computed,onMounted,ref } from 'vue'; import { useRoute } from 'vue-router'; import Button from '@frappe/Button'; import { getLesson } from '../data/supabase/lessons'; import { getProgress,setLessonComplete } from '../data/supabase/progress'; import { useSessionStore } from '../stores/session'
const route=useRoute(); const session=useSessionStore(); const lesson=ref(null); const done=ref(false); const saving=ref(false)
const html=computed(()=>lesson.value?.content?.html || lesson.value?.content?.body || '<p>Lesson content is being prepared.</p>')
onMounted(async()=>{lesson.value=await getLesson(route.params.lessonId); const rows=await getProgress(route.params.courseId); done.value=rows.some(x=>x.lesson_id===route.params.lessonId&&x.completed)})
async function complete(){saving.value=true;try{await setLessonComplete({lessonId:lesson.value.id,courseId:route.params.courseId,userId:session.session.user.id,completed:true});done.value=true}finally{saving.value=false}}
</script>
