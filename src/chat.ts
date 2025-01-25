import { OpenAI } from 'openai'
import { failWithOutput } from './utils.js'

export class Chat {
  language: string
  model: string
  temperature: number
  max_tokens: number
  private openai: OpenAI

  constructor() {
    this.language = process.env.LANGUAGE || 'Chinese'
    const supported_languages = ['Chinese', 'English']
    if (!supported_languages.includes(this.language)) {
      failWithOutput(`Language must be one of ${supported_languages}`)
    }
    this.model = process.env.MODEL || 'gpt-4o-mini'
    this.temperature = process.env.TEMPERATURE ? +process.env.TEMPERATURE : 1.0
    this.max_tokens = process.env.MAX_TOKENS ? +process.env.MAX_TOKENS : 4096

    if (!process.env.OPENAI_API_KEY) {
      failWithOutput('OPENAI_API_KEY is not set')
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    })
  }

  public reviewPatch = async (patch: string) => {
    const res = await this.openai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: createReviewPatchPrompt(this.language, patch)
        }
      ],
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.max_tokens
    })

    return res.choices?.[0].message.content
  }
}

const createReviewPatchPrompt = (language: string, patch: string) => {
  switch (language) {
    case 'Chinese':
      return `
我将提供给你一段github pull request的代码变更片段。请你扮演一位专业的开源社区开发者，帮我进行代码审核。
[[代码审核原则]]
[代码质量]
1. 该修改是否有必要，是否相比旧代码有改进或添加了新功能？
2. 是否有逻辑错误或潜在的运行时错误？
3. 是否有与其他代码部分的兼容性问题，会不会破坏与修改无关的现有逻辑？
4. 是否有可以优化的代码结构或逻辑，是否有更简洁或更高效的方式来实现相同功能？
5. 是否有潜在的性能问题？
[安全性]
6. 是否有敏感信息泄露的风险（如硬编码的密钥、密码等）？
7. 是否有可能运行来路不明的外部代码？

[[需要审核的代码边跟片段]]
${patch}

[[结果返回格式]]
1. 用中文返回结果
2. 如果没有问题，请直接输出“LGTM”四个字母表示通过，不用再输出任何其他解释。
3. 如果发现任何问题或改进建议，请分点详细列出并说明。切记不要输出“LGTM”。

[[你的审核结果]]
`
    case 'English':
      return `
I will provide you with a code change snippet from a GitHub pull request. Please act as a professional open-source community developer and help me review the code.

[[Code Review Principles]]
[Code Quality]
1. Is the modification necessary? Does it improve or add new functionality compared to the old code?
2. Are there any logical errors or potential runtime errors?
3. Are there any compatibility issues with other parts of the code? Will it break existing logic that is unrelated to the modification?
4. Can the code structure or logic be optimized? Is there a simpler or more efficient way to achieve the same functionality?
5. Are there any potential performance issues?

[Security]
6. Is there a risk of sensitive information leakage (such as hardcoded keys, passwords, etc.)?
7. Is there a possibility of running untrusted external code?

[[Code Snippet to Be Reviewed]]
${patch}

[[Result Format]]
1. Answer in English.
2. If there are no issues, please simply output the letters "LGTM" to indicate approval, without providing any further explanation.
3. If any issues or suggestions for improvement are found, please list them in detail point by point and explain. Please do not use the letters "LGTM" in this case.

[[Your Review Result]]
`
  }
  return ''
}
