<template>
  <div class="page">
    <header class="page-header"><div><p class="eyebrow">LEARNING CATALOGUE</p><h1>Courses</h1></div><Badge :label="`${courses.length} available`" /></header>
    <div v-if="loading" class="state">Loading courses...</div>
    <div v-else-if="!courses.length" class="empty"><BookOpen :size="34"/><h2>No published courses yet</h2><p>Courses published by HR will appear here.</p></div>
    <div v-else class="course-grid">
      <RouterLink v-for="course in courses" :key="course.id" :to="`/courses/${course.id}`" class="course-card">
        <div class="course-image" :style="course.image_url ? { backgroundImage: `url(${course.image_url})` } : {}"><span v-if="!course.image_url">{{ course.title }}</span></div>
        <div class="course-body"><Badge v-if="course.category" :label="course.category"/><h2>{{ course.title }}</h2><p>{{ course.short_description || course.description }}</p><span class="course-link">View course <ArrowRight :size="16"/></span></div>
      </RouterLink>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref } from 'vue'; import { ArrowRight, BookOpen } from 'lucide-vue-next'; import Badge from '@frappe/Badge'; import { listCourses } from '../data/supabase/courses'
const courses=ref([]); const loading=ref(true); onMounted(async()=>{try{courses.value=await listCourses()}finally{loading.value=false}})
</script>
