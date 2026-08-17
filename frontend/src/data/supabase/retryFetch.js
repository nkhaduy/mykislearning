const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export function createRetryFetch(fetchImpl = fetch, { attempts = 3, delayMs = 150 } = {}) {
  return async (input, init) => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fetchImpl(input, init)
      } catch (error) {
        if (attempt === attempts || init?.signal?.aborted || !(error instanceof TypeError)) throw error
        await wait(delayMs * attempt)
      }
    }
  }
}
