## TLDR

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
      with:
        kustomize-version: "3.1.0"
    - run: git clone https://${REPO_TOKEN}@github.com/org/deployment.git .
      env:
        REPO_TOKEN: ${{secrets.REPO_TOKEN}}
    - run: git branch deployment/app/${GITHUB_REF/refs\/heads\//}
    - run: kustomize edit set image app:${GITHUB_SHA}
    - run: git add .
    - run: git commit -m "Set `app` image tag to `${GITHUB_SHA}`"
    - run: git push origin deployment/app/${GITHUB_REF/refs\/heads\//}
```
