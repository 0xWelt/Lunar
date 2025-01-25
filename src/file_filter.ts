import { minimatch } from 'minimatch'
import { failWithOutput } from './utils.js'

interface File {
  filename: string
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
        failWithOutput(`Invalid pattern: ${pattern} with ${e}`)
        return false
      }
    }
  })
}

export const filterFile = (file: File) => {
  // if ignorePatterns is not empty, ignore files that match the pattern
  const ignore_patterns = 'autowsgr/data/**/*'
    .split(',')
    .filter((v) => Boolean(v.trim()))
  if (ignore_patterns) {
    return !matchPatterns(ignore_patterns, file.filename)
  }
  return true
}
