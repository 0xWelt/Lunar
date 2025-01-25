import { minimatch } from 'minimatch'
import { failWithOutput } from './utils.js'

interface File {
  filename: string
  status: string
  contents_url: string
}

const matchPatterns = (patterns: string[], path: string) => {
  return patterns.some((pattern) => {
    try {
      return minimatch(
        path,
        pattern.startsWith('/')
          ? '**' + pattern
          : pattern.startsWith('**')
            ? pattern
            : '**/' + pattern
      )
    } catch {
      // if the pattern is not a valid glob pattern, try to match it as a regular expression
      try {
        return new RegExp(pattern).test(path)
      } catch (e) {
        failWithOutput(`Invalid pattern: ${pattern} with error ${e}`)
        return false
      }
    }
  })
}

export const filterFile = (file: File) => {
  const ignore_patterns = (process.env.IGNORE_PATTERNS || '')
    .split(',')
    .filter((v) => Boolean(v.trim()))
  const url = new URL(file.contents_url)

  // if ignorePatterns is not empty, ignore files that match the pattern
  if (ignore_patterns) {
    return !matchPatterns(ignore_patterns, url.pathname)
  }

  return true
}
