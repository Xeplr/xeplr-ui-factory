// A PHONE HAS NO URL. @xeplr/ui-utils' URL state (which ui-factory's
// controllers use for open steps, a list's search, the open popup) asks
// react-router whether it is inside a router, and keeps everything in memory
// when it is not. React Native has no router — and react-router's own code
// does not compile for Hermes — so a phone app points 'react-router-dom' here
// (metro.config.js: resolver.resolveRequest), and the answer is always "no".
export function useInRouterContext() {
  return false
}

export function useSearchParams() {
  throw new Error('No router on a phone — useUrlState keeps its state in memory instead')
}
