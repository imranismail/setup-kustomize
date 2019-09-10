# Github Action for setting up Kustomize

## Getting Started

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
    - uses: imranismail/setup-kustomize@master
      with:
        kustomize-version: "3.1.0"
    - run: git clone https://${REPO_TOKEN}@github.com/kfit-dev/deployments.git .
      env:
        REPO_TOKEN: ${{secrets.REPO_TOKEN}}
    - run: git branch deployments/favefood/${GITHUB_REF/refs\/heads/}
    - run: kustomize edit set image favefood:${GITHUB_SHA}
    - run: git add .
    - run: git commit -m "Set `favefood` image tag to ${GITHUB_SHA}"
    - run: git push origin deployments/favefood/${GITHUB_REF/refs\/heads/}
```
