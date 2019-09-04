import * as core from '@actions/core';
import * as installer from './installer';

async function run() {
  try {
    //
    // Version is optional.  If supplied, install / use from the tool cache
    // If not supplied then task is still used to setup proxy, auth, etc...
    //
    let version = core.getInput('kustomize-version');

    if (version) {
      await installer.getKustomize(version);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();