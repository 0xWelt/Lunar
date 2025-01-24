import { OpenAI } from 'openai'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/rest'

const failWithOutput = (message: string) => {
  console.error(message)
  core.setFailed(message)
}
export class Chat {
  private openai: OpenAI
  private review_prompt: string

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      failWithOutput('OPENAI_API_KEY is not set')
      throw new Error()
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    })

    this.review_prompt =
      process.env.REVIEW_PROMPT ||
      'Below is a code patch, please help me do a brief code review on it. Any bug risks and/or improvement suggestions are welcome:'
  }

  public reviewPatch = async (patch: string) => {
    const res = await this.openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `${this.review_prompt}\n${patch}`
        }
      ],
      model: process.env.MODEL || 'gpt-4o-mini',
      temperature: process.env.temperature ? +process.env.temperature : 1.0,
      max_tokens: process.env.max_tokens ? +process.env.max_tokens : 4096
    })

    if (res.choices) {
      return res.choices[0].message.content
    }

    failWithOutput('No response from OpenAI')
    return ''
  }
}

export class AIReviewer {
  private octokit
  private repo
  private pull_request

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      failWithOutput('GITHUB_TOKEN is not set.')
      throw new Error()
    }
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    this.repo = github.context.repo
    if (!github.context.payload.pull_request) {
      failWithOutput('This action only works on pull requests.')
      throw new Error()
    }
    this.pull_request = github.context.payload.pull_request
  }

  async main() {
    // setup chat
    const chat = new Chat()

    // get the diff of the pull request
    const data = await this.octokit.repos.compareCommits({
      owner: this.repo.owner,
      repo: this.repo.repo,
      base: this.pull_request.base.sha,
      head: this.pull_request.head.sha
    })
    const { files: changed_files, commits } = data.data

    // review diff
    if (changed_files) {
      console.log(`Start reviewing ${changed_files.length} files`)

      // create AI reviews
      const reviews = []
      for (const file of changed_files) {
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
          const res = await chat.reviewPatch(patch)
          console.log(`Review for ${filename}:`, res)
          if (res) {
            reviews.push({
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
      if (reviews.length > 0) {
        console.log(`Posting ${reviews.length} reviews`)
        await this.octokit.pulls.createReview({
          owner: this.repo.owner,
          repo: this.repo.repo,
          pull_number: this.pull_request.number,
          commit_id: commits[commits.length - 1].sha,
          event: 'COMMENT',
          comments: reviews
        })
      } else {
        console.log('No reviews to post')
      }
    } else {
      console.log('No files changed')
    }
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
