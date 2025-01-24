import { OpenAI } from 'openai'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/rest'
import { createReviewPrompt } from './prompts.js'

const failWithOutput = (message: string) => {
  console.error(message)
  core.setFailed(message)
  throw new Error(message)
}
export class Chat {
  private language: string
  private openai: OpenAI
  private model: string

  constructor(model: string) {
    this.language = process.env.LANGUAGE || 'Chinese'
    const supported_languages = ['Chinese', 'English']
    if (!supported_languages.includes(this.language)) {
      failWithOutput(`Language must be one of ${supported_languages}`)
    }

    if (!process.env.OPENAI_API_KEY) {
      failWithOutput('OPENAI_API_KEY is not set')
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    })

    this.model = model
  }

  public reviewPatch = async (patch: string) => {
    const res = await this.openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: createReviewPrompt(this.language, patch)
        }
      ],
      model: this.model,
      temperature: process.env.TEMPERATURE ? +process.env.TEMPERATURE : 1.0,
      max_tokens: process.env.MAX_TOKENS ? +process.env.MAX_TOKENS : 4096
    })

    if (res.choices) {
      return res.choices[0].message.content
    }
    failWithOutput('No response from OpenAI')
  }
}

export class AIReviewer {
  private model: string

  private octokit
  private repo
  private pull_request

  constructor() {
    this.model = process.env.MODEL || 'gpt-4o-mini'

    if (!process.env.GITHUB_TOKEN) {
      failWithOutput('GITHUB_TOKEN is not set.')
    }
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    this.repo = github.context.repo
    if (!github.context.payload.pull_request) {
      failWithOutput('This action only works on pull requests.')
      throw new Error('This action only works on pull requests.')
    }
    this.pull_request = github.context.payload.pull_request
  }

  async main() {
    // setup chat
    const chat = new Chat(this.model)

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
          if (res && !res.includes('LGTM')) {
            // skip LGTM reviews
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
          body: `Review from ${this.model}: ${reviews.length} issues found.`,
          event: 'COMMENT',
          comments: reviews
        })
      } else {
        console.log('No reviews to post')
        await this.octokit.pulls.createReview({
          owner: this.repo.owner,
          repo: this.repo.repo,
          pull_number: this.pull_request.number,
          commit_id: commits[commits.length - 1].sha,
          body: `Review from ${this.model}: LGTM!`,
          event: 'COMMENT'
        })
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
