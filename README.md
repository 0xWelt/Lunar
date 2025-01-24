# Lunar

> Yet another AI powered code reviewer

Lunar is short for 'LUnar is Not an Ai Reviewer'.

## Featuers

- Review Pull Requests with AI and directly comment on each file.
  ([example pr](https://github.com/0xWelt/test-action/pull/2))

  ![review](./docs/review.png)

- Beyond default GPT-4o-mini, Lunar can also use other LLMs like Deepseek, Kimi,
  etc. You only need to specify the `OPENAI_API_KEY` in actions' secrets and
  `OPENAI_BASE_URL` and `MODEL` in the environment variables.

## Use Lunar as Github Actions

1.  Add the `OPENAI_API_KEY` to your github actions secrets.

    ![actions_secrets](./docs/actions_secrets.png)

2.  create `.github/workflows/lunar.yml`

    ```yaml
    name: Lunar Code Review

    permissions:
      contents: read
      pull-requests: write

    on:
      pull_request_target:
        types: [opened, reopened, synchronize]

    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: 0xWelt/Lunar@main
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
              OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
              # Optional, change as you wish or comment out to use default
              OPENAI_BASE_URL: https://api.deepseek.com/v1 # https://api.openai.com/v1
              MODEL: deepseek-chat # gpt-4o-mini
              LANGUAGE: Chinese # Chinese
              TEMPERATURE: 1.0 # 1.0
              MAX_TOKENS: 8192 # 4096
    ```

## Develop Plan

- [x] Review Pull Requests with AI and directly comment on each file.
- [ ] Add **icons** and **model names** for popular LLMs.
- [ ] Multi-turn conversation support. Context aware code suggestions.
