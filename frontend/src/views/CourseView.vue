<template>
  <div class="page" v-if="course">
    <RouterLink to="/courses" class="back">← All courses</RouterLink>
    <section class="course-hero"><div><p class="eyebrow">{{ course.category || 'COURSE' }}</p><h1>{{ course.title }}</h1><p>{{ course.description || course.short_description }}</p><Button v-if="course.self_enroll_enabled" variant="solid" theme="gray" @click="join" :loading="joining">Enroll now</Button></div><div class="hero-art" :style="course.image_url ? {backgroundImage:`url(${course.image_url})`}:{}"></div></section>
    <section class="outline"><h2>Course outline</h2><div v-for="(chapter,index) in outline" :key="chapter.id" class="chapter"><h3><span>{{ index+1 }}</span>{{ chapter.title }}</h3><RouterLink v-for="lesson in chapter.lessons" :key="lesson.id" :to="`/courses/${course.id}/lessons/${lesson.id}`" class="lesson-row"><PlayCircle :size="18"/>{{ lesson.title }}<span>Open</span></RouterLink></div></section>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'; import { useRoute } from 'vue-router'; import Button from '@frappe/Button'; import { PlayCircle } from 'lucide-vue-next'; import { enroll,getCourse,getOutline } from '../data/supabase/courses'; import { useSessionStore } from '../stores/session'
const route=useRoute(); const session=useSessionStore(); const course=ref(null); const outline=ref([]); const joining=ref(false)
onMounted(async()=>{[course.value,outline.value]=await Promise.all([getCourse(route.params.id),getOutline(route.params.id)])})
async function join(){joining.value=true;try{await enroll(course.value.id,session.profile.id)}finally{joining.value=false}}
</script>
