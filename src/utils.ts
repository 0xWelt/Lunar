import * as core from '@actions/core'

export const failWithOutput = (message: string) => {
  console.error(message)
  core.setFailed(message)
  throw new Error(message)
}
