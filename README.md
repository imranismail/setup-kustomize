![build-test](https://github.com/imranismail/setup-kustomize/workflows/build-test/badge.svg)

## Description

Install any kustomize version as a step in your workflow

## Options

Every argument is optional.

| Input               | Description                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`      | PAT (Personal Access Token) for authorizing the repository.<br>_Defaults to **\${{ github.token }}**_                                                                                                                                   |
| `kustomize-version` | Semver of kustomize to use. Examples: `10.x`, `10.15.1`, `>=10.15.0`<br>_Defaults to **\***_                                                                                                                                            |
| `fail-fast`         | When github rate limits us, fail immediately or retry after the timeout that github wishes from us? Note: When setting this to `false` (which is the default!), a github workflow might accrue a long (and possibly expensive) runtime. |

## Usage

```yaml
on:
  push:
    branches:
      - master

jobs:
  create-deployment-branch:
    runs-on: ubuntu-latest
    needs:
      - publish-image
    steps:
      - uses: imranismail/setup-kustomize@v1
      - run: |
          kustomize edit set image app:${GITHUB_SHA}
          git add .
          git commit -m "Set `app` image tag to `${GITHUB_SHA}`"
          git push
```
