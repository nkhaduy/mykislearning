<template>
  <div class="page admin-page">
    <header class="page-header"><div><p class="eyebrow">HR AUTHORING</p><h1>Course editor</h1></div></header>
    <section class="editor-panel">
      <h2>Create course</h2>
      <div class="form-grid"><FormControl v-model="course.id" label="Course ID"/><FormControl v-model="course.title" label="Title"/><FormControl v-model="course.short_description" label="Short description"/><FormControl v-model="course.category" label="Category"/></div>
      <div class="checks"><FormControl v-model="course.published" type="checkbox" label="Published"/><FormControl v-model="course.self_enroll_enabled" type="checkbox" label="Allow self enrollment"/></div>
      <Button variant="solid" theme="gray" @click="save" :loading="saving">Save course</Button>
    </section>
    <section v-if="savedCourse" class="editor-panel">
      <h2>Add chapter and lesson</h2>
      <div class="form-grid"><FormControl v-model="chapterTitle" label="Chapter title"/><FormControl v-model="lessonTitle" label="Lesson title"/></div>
      <FormControl v-model="lessonHtml" type="textarea" label="Lesson HTML"/>
      <Button @click="addOutline" :loading="savingOutline">Add outline</Button>
      <p v-if="message" class="success">{{ message }}</p>
    </section>
  </div>
</template>
<script setup>
import { reactive,ref } from 'vue'; import Button from '@frappe/Button'; import FormControl from '@frappe/FormControl'; import { createChapter,createLesson,saveCourse } from '../data/supabase/admin'; import { useSessionStore } from '../stores/session'
const session=useSessionStore(); const course=reactive({id:'',title:'',short_description:'',category:'',status:'draft',published:false,self_enroll_enabled:false,created_by:session.profile.id,data:{}}); const savedCourse=ref(null); const saving=ref(false); const savingOutline=ref(false); const chapterTitle=ref('Introduction'); const lessonTitle=ref('Welcome'); const lessonHtml=ref('<p>Welcome to this course.</p>'); const message=ref('')
async function save(){saving.value=true;try{course.status=course.published?'published':'draft';savedCourse.value=await saveCourse({...course})}finally{saving.value=false}}
async function addOutline(){savingOutline.value=true;try{const chapter=await createChapter({course_id:savedCourse.value.id,title:chapterTitle.value});await createLesson({course_id:savedCourse.value.id,chapter_id:chapter.id,title:lessonTitle.value,content:{html:lessonHtml.value},published:savedCourse.value.published});message.value='Chapter and lesson created.'}finally{savingOutline.value=false}}
</script>
