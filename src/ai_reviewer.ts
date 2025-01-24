import { OpenAI } from 'openai'
import * as core from '@actions/core'
import * as github from '@actions/github'

export class Chat {
  private openai: OpenAI
  private review_prompt: string

  constructor(apikey: string) {
    this.openai = new OpenAI({
      apiKey: apikey,
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
      temperature: +(process.env.temperature || 0) || 1,
      max_tokens: process.env.max_tokens ? +process.env.max_tokens : undefined
    })

    if (res.choices) {
      return res.choices[0].message.content
    }

    core.setFailed('No response from OpenAI')
    return ''
  }
}

export class AIReviewer {
  private octokit
  private repo
  private pull_request

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN is not set.')
    }
    this.octokit = github.getOctokit(process.env.GITHUB_TOKEN).rest
    this.repo = github.context.repo
    if (!github.context.payload.pull_request) {
      throw new Error('This action only works on pull requests.')
    }
    this.pull_request = github.context.payload.pull_request
  }

  private failWithComment = async (message: string) => {
    core.setFailed(message)
    await this.octokit.issues.createComment({
      repo: this.repo.repo,
      owner: this.repo.owner,
      issue_number: this.pull_request.number,
      body: message
    })
  }

  private setupChat = async () => {
    if (process.env.OPENAI_API_KEY) {
      return new Chat(process.env.OPENAI_API_KEY)
    }
    await this.failWithComment('OPENAI_API_KEY is not set.')
    return null
  }

  async main() {
    // setup chat
    const chat = await this.setupChat()
    if (!chat) {
      console.error('Failed to setup chat.')
      return
    }

    // get the diff of the pull request
    const data = await this.octokit.repos.compareCommits({
      owner: this.repo.owner,
      repo: this.repo.repo,
      base: this.pull_request.base.sha,
      head: this.pull_request.head.sha
    })
    const { files: changed_files, commits } = data.data

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
          if (res) {
            reviews.push({
              path: filename,
              body: res,
              position: patch.split('\n').length - 1
            })
          }
        } catch (error) {
          console.error(`Failed to review ${filename}:`, error)
          continue
        }
      }

      // create comments
      await this.octokit.pulls.createReview({
        repo: this.repo.repo,
        owner: this.repo.owner,
        pull_number: this.pull_request.pull_number,
        body: 'Code review by ChatGPT',
        event: 'COMMENT',
        commit_id: commits[commits.length - 1].sha,
        comments: reviews
      })
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
