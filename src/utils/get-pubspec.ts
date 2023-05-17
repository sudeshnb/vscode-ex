import * as yaml from "js-yaml";
import { getPubspecPath, getPubspecLockPath } from "./get-pubspec-path";
import { workspace, Uri } from "vscode";

export async function getPubspec(){
  const pubspecPath = getPubspecPath();
  return getYAMLFileContent(pubspecPath);
}

export async function getPubspecLock(){
  const pubspecLockPath = getPubspecLockPath();
  return getYAMLFileContent(pubspecLockPath);
}

async function getYAMLFileContent(path: string | undefined){
  if (path) {
    try {
      let content = await workspace.fs.readFile(Uri.file(path));
      return yaml.load(content.toString());
    } catch (_) {}
  }
}