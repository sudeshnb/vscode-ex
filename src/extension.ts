import * as _ from "lodash";
import * as changeCase from "change-case";
import * as mkdirp from 'mkdirp';
import * as path from "path";

import {
  commands,
  ExtensionContext,
  InputBoxOptions,
  OpenDialogOptions,
  QuickPickOptions,
  Uri,
  window,
  workspace
} from "vscode";
import { existsSync, lstatSync, writeFile, appendFile } from "fs";
import {
  getBlocEventTemplate,
  getBlocStateTemplate,
  getBlocTemplate,
  getCubitStateTemplate,
  getCubitTemplate,
} from "./templates";
import { analyzeDependencies } from "./utils";
import { getBlocType, BlocType, TemplateType } from "./utils";


export function activate (_context: ExtensionContext) {
  // analyzeDependencies();
  // if (workspace.getConfiguration("bloc").get<boolean>("checkForUpdates")) {
  analyzeDependencies();
  // }
  commands.registerCommand("onyxsio.new-feature-bloc", async (uri: Uri) => {
    mainCommand(uri, false);
  });

  commands.registerCommand("onyxsio.new-feature-cubit", async (uri: Uri) => {
    mainCommand(uri, true);
  });
  
  commands.registerCommand("onyxsio.new-core", async (uri: Uri) => {
    mainCommand(uri, true);
  });
}

export async function mainCommand (uri: Uri, useCubit: boolean) {
  // Show feature prompt
  let featureName = await promptForFeatureName();

  // Abort if name is not valid
  if (!isNameValid(featureName)) {
    window.showErrorMessage("The feature name must not be empty.");
    return;
  }
  featureName = `${featureName}`;

  let targetDirectory = "";
  try {
    targetDirectory = await getTargetDirectory(uri);
  } catch (error) {
    window.showErrorMessage('error: ${error}');
  }

  // const blocType = await getBlocType(useCubit?TemplateType.Bloc:TemplateType.Cubit);
  const blocType = await promptForUseEquatable();

  const pascalCaseFeatureName = changeCase.pascalCase(
    featureName.toLowerCase()
  );
  try {
    await generateFeatureArchitecture(
      `${featureName}`,
      targetDirectory,
      blocType,
      useCubit
    );
    window.showInformationMessage(
      `Successfully Generated ${pascalCaseFeatureName} Feature`
    );
  } catch (error) {
    window.showErrorMessage(
      `Error:
        ${error instanceof Error ? error.message : JSON.stringify(error)}`
    );
  }
}

export function isNameValid (featureName: string | undefined): boolean {
  // Check if feature name exists
  if (!featureName) {
    return false;
  }
  // Check if feature name is null or white space
  if (_.isNil(featureName) || featureName.trim() === "") {
    return false;
  }
  // Return true if feature name is valid
  return true;
}

export async function getTargetDirectory (uri: Uri): Promise<string> {
  let targetDirectory;
  if (_.isNil(_.get(uri, "fsPath")) || !lstatSync(uri.fsPath).isDirectory()) {
    targetDirectory = await promptForTargetDirectory();
    if (_.isNil(targetDirectory)) {
      throw Error("Please select a valid directory");
    }
  } else {
    targetDirectory = uri.fsPath;
  }
  // workspace.getWorkspaceFolder(uri.path);
  // return  path.join(`${uri.fsPath}/lib`);
  return targetDirectory;
}

export async function promptForTargetDirectory (): Promise<string | undefined> {
  const options: OpenDialogOptions = {
    canSelectMany: false,
    openLabel: "Select a folder to create the feature in",
    canSelectFolders: true,
  };

  return window.showOpenDialog(options).then((uri) => {
    if (_.isNil(uri) || _.isEmpty(uri)) {
      return undefined;
    }
    return uri[0].fsPath;
  });
}

export function promptForFeatureName (): Thenable<string | undefined> {
  const blocNamePromptOptions: InputBoxOptions = {
    prompt: "Feature Name",
    placeHolder: "home,auth ...etc",
  };
  return window.showInputBox(blocNamePromptOptions);
}

export async function promptForUseEquatable ():  Promise<BlocType> {
  const useEquatablePromptValues: string[] = ["no (default)", "Equatable", "Freezed"];
  const useEquatablePromptOptions: QuickPickOptions = {
    placeHolder:
      "Do you want to use the Equatable Package in bloc to override equality comparisons?",
    canPickMany: false,
  };

  const answer = await window.showQuickPick(
    useEquatablePromptValues,
    useEquatablePromptOptions
  );

  switch (answer) {
    case "Freezed":
      return BlocType.Freezed;
    case "Equatable":
      return BlocType.Equatable;
    default:
      return BlocType.Simple;
  }
  // return answer === "yes (advanced)";
}

async function generateBlocCode (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const blocDirectoryPath = `${targetDirectory}/Bloc`;
  if (!existsSync(blocDirectoryPath)) {
    await createDirectory(blocDirectoryPath);
  }

  await Promise.all([
    createBlocEventTemplate(blocName, targetDirectory, type),
    createBlocStateTemplate(blocName, targetDirectory, type),
    createBlocTemplate(blocName, targetDirectory, type),
  ]);
}

async function generateCubitCode (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const blocDirectoryPath = `${targetDirectory}/Cubit`;
  if (!existsSync(blocDirectoryPath)) {
    await createDirectory(blocDirectoryPath);
  }

  await Promise.all([
    createCubitStateTemplate(blocName, targetDirectory, type),
    createCubitTemplate(blocName, targetDirectory, type),
  ]);
}

export async function generateFeatureArchitecture (
  featureName: string,
  targetDirectory: string,
  type: BlocType,
  useCubit: boolean
) {
  // Create the features directory if its does not exist yet
  const featuresDirectoryPath = getFeaturesDirectoryPath(targetDirectory);
  if (!existsSync(featuresDirectoryPath)) {
    await createDirectory(featuresDirectoryPath);
  }

  // Create the feature directory
  const featureDirectoryPath = path.join(featuresDirectoryPath, featureName);
  await createDirectory(featureDirectoryPath);

  // Create the data layer
  const dataDirectoryPath = path.join(featureDirectoryPath, "Data");
  await createDirectories(dataDirectoryPath, [
    "Datasources",
    "Models",
    "Repositories",
  ]);

  // Create the domain layer
  const domainDirectoryPath = path.join(featureDirectoryPath, "Domain");
  await createDirectories(domainDirectoryPath, [
    "Entities",
    "Repositories",
    "Usecases",
  ]);

  // Create the presentation layer
  const presentationDirectoryPath = path.join(
    featureDirectoryPath,
    "Presentation"
  );
  await createDirectories(presentationDirectoryPath, [
    useCubit ? "Cubit" : "Bloc",
    "Pages",
    "Widgets",
  ]);
    
  // Generate the bloc code in the presentation layer
  
  useCubit
    ? await generateCubitCode(featureName, presentationDirectoryPath, type)
    : await generateBlocCode(featureName, presentationDirectoryPath, type);
}

export function getFeaturesDirectoryPath (currentDirectory: string): string {
  // Split the path
  const splitPath = currentDirectory.split(path.sep);

  // Remove trailing \
  if (splitPath[splitPath.length - 1] === "") {
    splitPath.pop();
  }

  // Rebuild path
  const result = splitPath.join(path.sep);

  // Determines whether we're already in the features directory or not
  const isDirectoryAlreadyFeatures =
    splitPath[splitPath.length - 1] === "Features";

  // If already return the current directory if not, return the current directory with the /features append to it
  return isDirectoryAlreadyFeatures ? result : path.join(result, "Features");
}

export async function createDirectories (
  targetDirectory: string,
  childDirectories: string[]
): Promise<void> {
  // Create the parent directory
  await createDirectory(targetDirectory);
  // Creat the children
  childDirectories.map(
    async (directory) =>
      await createDirectory(path.join(targetDirectory, directory))
  );
}

function createDirectory (targetDirectory: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // mkdirp(targetDirectory).then((value)=>{resolve();}).catch((error) => {return reject(error);});
    mkdirp(targetDirectory, (error) => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  
  });
}

function createBlocEventTemplate (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const snakeCaseBlocName = changeCase.snakeCase(blocName.toLowerCase());
  const targetPath = `${targetDirectory}/Bloc/${snakeCaseBlocName}_event.dart`;
  if (existsSync(targetPath)) {
    throw Error(`${snakeCaseBlocName}_event.dart already exists`);
  }
  return new Promise(async (resolve, reject) => {
    writeFile(
      targetPath,
      getBlocEventTemplate(blocName, type),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    );
  });
}

function createBlocStateTemplate (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const snakeCaseBlocName = changeCase.snakeCase(blocName.toLowerCase());
  const targetPath = `${targetDirectory}/Bloc/${snakeCaseBlocName}_state.dart`;
  if (existsSync(targetPath)) {
    throw Error(`${snakeCaseBlocName}_state.dart already exists`);
  }
  return new Promise(async (resolve, reject) => {
    writeFile(
      targetPath,
      getBlocStateTemplate(blocName, type),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    );
  });
}

function createBlocTemplate (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const snakeCaseBlocName = changeCase.snakeCase(blocName.toLowerCase());
  const targetPath = `${targetDirectory}/Bloc/${snakeCaseBlocName}_bloc.dart`;
  if (existsSync(targetPath)) {
    throw Error(`${snakeCaseBlocName}_bloc.dart already exists`);
  }
  return new Promise(async (resolve, reject) => {
    writeFile(
      targetPath,
      getBlocTemplate(blocName, type),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    );
  });
}

function createCubitStateTemplate (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const snakeCaseBlocName = changeCase.snakeCase(blocName.toLowerCase());
  const targetPath = `${targetDirectory}/Cubit/${snakeCaseBlocName}_state.dart`;
  if (existsSync(targetPath)) {
    throw Error(`${snakeCaseBlocName}_state.dart already exists`);
  }
  return new Promise(async (resolve, reject) => {
    writeFile(
      targetPath,
      getCubitStateTemplate(blocName, type),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    );
  });
}

function createCubitTemplate (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const snakeCaseBlocName = changeCase.snakeCase(blocName.toLowerCase());
  const targetPath = `${targetDirectory}/Cubit/${snakeCaseBlocName}_cubit.dart`;
  if (existsSync(targetPath)) {
    throw Error(`${snakeCaseBlocName}_cubit.dart already exists`);
  }
  return new Promise(async (resolve, reject) => {
    writeFile(
      targetPath,
      getCubitTemplate(blocName, type),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    );
  });
}