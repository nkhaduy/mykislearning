#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_REF="mooqdtiedfamnlpitqtq"
readonly BASE_URL="https://${PROJECT_REF}.supabase.co"
readonly COURSE_ID="frappe-api-$(date +%s)"
readonly -a CURL_OPTIONS=(--retry 3 --retry-all-errors --connect-timeout 10 --max-time 60)

source "$HOME/.config/mykis/deploy.env"
api_keys="$(curl "${CURL_OPTIONS[@]}" -fsS "https://api.supabase.com/v1/projects/$PROJECT_REF/api-keys" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")"
anon_key="$(printf '%s' "$api_keys" | jq -r '.[] | select(.name=="anon" or .type=="publishable") | .api_key' | head -1)"

login() {
  local email="$1" service="$2" password response
  password="$(security find-generic-password -w -s "$service" -a "$email")"
  response="$(curl "${CURL_OPTIONS[@]}" -fsS -X POST "$BASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $anon_key" -H 'Content-Type: application/json' \
    --data "$(jq -cn --arg email "$email" --arg password "$password" '{email:$email,password:$password}')")"
  printf '%s' "$response" | jq -r '.access_token'
}

hr_token="$(login frappe.hr.e2e@kislms.site kislms-frappe-e2e-hr)"
employee_token="$(login frappe.employee.e2e@kislms.site kislms-frappe-e2e-employee)"

hr_course="$(jq -cn --arg id "$COURSE_ID" '{id:$id,title:"Frappe LMS Production Readiness",short_description:"Core employee learning flow",description:"A production verification course for the Frappe-derived Supabase frontend.",status:"published",published:true,self_enroll_enabled:true,created_by:"frappe-e2e-hr",data:{}}')"
hr_status="$(curl "${CURL_OPTIONS[@]}" -sS -o /tmp/kislms-hr-course.json -w '%{http_code}' -X POST \
  "$BASE_URL/rest/v1/courses?on_conflict=id" -H "apikey: $anon_key" \
  -H "Authorization: Bearer $hr_token" -H 'Content-Type: application/json' \
  -H 'Prefer: resolution=merge-duplicates,return=representation' --data "$hr_course")"
printf 'HR course write HTTP %s.\n' "$hr_status"
test "$hr_status" = 201

chapter_id="$(curl "${CURL_OPTIONS[@]}" -fsS -X POST "$BASE_URL/rest/v1/chapters" -H "apikey: $anon_key" \
  -H "Authorization: Bearer $hr_token" -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  --data "$(jq -cn --arg course "$COURSE_ID" '{course_id:$course,title:"Getting started",sort_order:1}')" | jq -r '.[0].id')"

lesson_payload="$(jq -cn --arg chapter "$chapter_id" \
  --arg course "$COURSE_ID" '{course_id:$course,chapter_id:$chapter,title:"Welcome to KIS Learning",content:{html:"<p>This lesson verifies the new Frappe-derived LMS flow.</p>"},sort_order:1,published:true}')"
lesson_id="$(curl "${CURL_OPTIONS[@]}" -fsS -X POST "$BASE_URL/rest/v1/lessons" -H "apikey: $anon_key" \
  -H "Authorization: Bearer $hr_token" -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' --data "$lesson_payload" | jq -r '.[0].id')"

profile_id="$(curl "${CURL_OPTIONS[@]}" -fsS "$BASE_URL/rest/v1/profiles?select=id" -H "apikey: $anon_key" \
  -H "Authorization: Bearer $employee_token" | jq -r '.[0].id')"
profile_uid="$(curl "${CURL_OPTIONS[@]}" -fsS "$BASE_URL/auth/v1/user" -H "apikey: $anon_key" \
  -H "Authorization: Bearer $employee_token" | jq -r '.id')"

course_count="$(curl "${CURL_OPTIONS[@]}" -fsS "$BASE_URL/rest/v1/courses?id=eq.$COURSE_ID&select=id" \
  -H "apikey: $anon_key" -H "Authorization: Bearer $employee_token" | jq 'length')"
test "$course_count" = 1

enrollment_payload="$(jq -cn --arg profile "$profile_id" \
  --arg course "$COURSE_ID" '{id:($course+":"+$profile),course_id:$course,account_id:$profile}')"
curl "${CURL_OPTIONS[@]}" -fsS -X POST "$BASE_URL/rest/v1/enrollments?on_conflict=course_id,account_id" \
  -H "apikey: $anon_key" -H "Authorization: Bearer $employee_token" \
  -H 'Content-Type: application/json' -H 'Prefer: resolution=merge-duplicates,return=minimal' \
  --data "$enrollment_payload" >/dev/null

lesson_count="$(curl "${CURL_OPTIONS[@]}" -fsS "$BASE_URL/rest/v1/lessons?id=eq.$lesson_id&select=id" \
  -H "apikey: $anon_key" -H "Authorization: Bearer $employee_token" | jq 'length')"
test "$lesson_count" = 1

progress_payload="$(jq -cn --arg lesson "$lesson_id" --arg uid "$profile_uid" \
  --arg course "$COURSE_ID" '{lesson_id:$lesson,course_id:$course,user_id:$uid,completed:true,completed_at:(now|todate)}')"
curl "${CURL_OPTIONS[@]}" -fsS -X POST "$BASE_URL/rest/v1/lesson_progress?on_conflict=lesson_id,user_id" \
  -H "apikey: $anon_key" -H "Authorization: Bearer $employee_token" \
  -H 'Content-Type: application/json' -H 'Prefer: resolution=merge-duplicates,return=minimal' \
  --data "$progress_payload" >/dev/null

negative_status="$(curl "${CURL_OPTIONS[@]}" -sS -o /tmp/kislms-employee-denied.json -w '%{http_code}' -X POST \
  "$BASE_URL/rest/v1/courses" -H "apikey: $anon_key" \
  -H "Authorization: Bearer $employee_token" -H 'Content-Type: application/json' \
  --data '{"id":"employee-must-not-create","title":"Denied","created_by":"frappe-e2e-employee","data":{}}')"
printf 'Employee denied write HTTP %s.\n' "$negative_status"
test "$negative_status" = 403

printf 'HR authoring PASS; Employee catalogue/enroll/lesson/progress PASS; Employee course mutation denied PASS.\n'
