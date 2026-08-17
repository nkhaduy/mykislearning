export function attachLegacyStyles(hrefs) {
  const links = hrefs.map((href) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.legacyPublicStyle = 'true'
    document.head.append(link)
    return link
  })

  return () => links.forEach((link) => link.remove())
}
