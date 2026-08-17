export async function submitLogin({ session, router, destination, email, password }) {
  await session.signIn(email, password)
  await router.replace(destination)
}
