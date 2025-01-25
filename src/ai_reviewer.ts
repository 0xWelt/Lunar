import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/rest'
import { failWithOutput } from './utils.js'
import { Chat } from './chat.js'
import { filterFile } from './file_filter.js'

export class AIReviewer {
  private repo
  private pull_request
  private trigger
  private octokit: Octokit
  private chat: Chat

  constructor() {
    this.repo = github.context.repo
    if (!github.context.payload.pull_request) {
      failWithOutput('This action only works on pull requests.')
      throw new Error('This action only works on pull requests.')
    }
    this.pull_request = github.context.payload.pull_request
    if (!process.env.GITHUB_TOKEN) {
      failWithOutput('GITHUB_TOKEN is not set.')
    }
    this.trigger = github.context.payload.action

    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    this.chat = new Chat()
  }

  async main() {
    // get the diff of the pull request
    const {
      data: { files, commits }
    } = await this.octokit.repos.compareCommits({
      owner: this.repo.owner,
      repo: this.repo.repo,
      base: this.pull_request.base.sha,
      head: this.pull_request.head.sha
    })
    let changed_files = files
    if (this.trigger === 'synchronize' && commits.length >= 2) {
      const {
        data: { files }
      } = await this.octokit.repos.compareCommits({
        owner: this.repo.owner,
        repo: this.repo.repo,
        base: commits[commits.length - 2].sha,
        head: commits[commits.length - 1].sha
      })
      changed_files = files
    }

    // filter files
    const num_changed_files = changed_files?.length || 0
    changed_files = changed_files?.filter(filterFile)
    const num_filtered_files = changed_files?.length || 0

    // create AI reviews
    const issues = []
    let num_reviews = 0
    for (const file of changed_files || []) {
      if (file.status !== 'modified' && file.status !== 'added') {
        console.log(`Skipping ${file.filename} with status ${file.status}`)
        continue
      }
      const { filename, patch } = file
      if (!patch) {
        console.log(`Skipping ${filename} with no changes`)
        continue
      }

      try {
        console.log(`Reviewing ${filename}`)
        num_reviews += 1
        const res = await this.chat.reviewPatch(patch)
        console.log(`Review for ${filename}:`, res)
        if (res && !res.includes('LGTM')) {
          // skip LGTM
          issues.push({
            path: filename,
            position: patch.split('\n').length - 1,
            body: res
          })
        }
      } catch (error) {
        console.error(`Failed to review ${filename}:`, error)
        continue
      }
    }

    // create comments
    const review_summary = `Review from [${this.chat.model}]:
    - Total changes: ${num_changed_files}
    - Filtered: ${num_filtered_files}
    - Reviewed: ${num_reviews}
    - Found issues: ${issues.length}`

    await this.octokit.pulls.createReview({
      owner: this.repo.owner,
      repo: this.repo.repo,
      pull_number: this.pull_request.number,
      commit_id: commits[commits.length - 1].sha,
      body: review_summary,
      event: 'COMMENT',
      comments: issues
    })
  }
}

export async function run(): Promise<void> {
  try {
    const reviewer = new AIReviewer()
    await reviewer.main()
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}
