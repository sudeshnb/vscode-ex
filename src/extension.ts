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
  workspace,
} from "vscode";

import { existsSync, lstatSync, writeFile, appendFile } from "fs";
import {
  getBlocEventTemplate,
  getBlocStateTemplate,
  getBlocTemplate,
  getCubitStateTemplate,
  getCubitTemplate,
  getTemplatePath,
  getTemplate,
  CoreType,
  getMainFileTemplate,
} from "./templates";
import { analyzeDependencies } from "./utils";
import { BlocType ,StateManagementType} from "./utils";
import { type } from "os";


export function activate (_context: ExtensionContext) {
  // analyzeDependencies();
  // if (workspace.getConfiguration("bloc").get<boolean>("checkForUpdates")) {
  analyzeDependencies();
  // }
  commands.registerCommand("onyxsio.new-feature", async (uri: Uri) => {
    mainCommand(uri);
  });

  // commands.registerCommand("onyxsio.new-feature-cubit", async (uri: Uri) => {
  //   mainCommand(uri, true);
  // });
  // commands.registerCommand("onyxsio.new-feature-getx", async (uri: Uri) => {
  //   mainCommand(uri, true);
  // });
  commands.registerCommand("onyxsio.new-core", async (uri: Uri) => {
    core(uri);
  });
}

// GETx

export async function getxCommand (uri: Uri) {
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

  const stateType = await promptForUseStateManagement();

  const blocType = await promptForUseEquatable();
  const pascalCaseFeatureName = changeCase.pascalCase(featureName.toLowerCase());
  
  try {
    await generateFeatureArchitecture(
      `${featureName}`,
      targetDirectory,
      blocType,
    stateType,
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







export async function mainCommand (uri: Uri) {
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
  const stateType = await promptForUseStateManagement();
  // const blocType = await getBlocType(useCubit?TemplateType.Bloc:TemplateType.Cubit);
  
  
 const blocType = await promptForUseBloc(stateType);

 
 
  const pascalCaseFeatureName = changeCase.pascalCase(featureName.toLowerCase()
  );
  try {
    await generateFeatureArchitecture(
      `${featureName}`,
      targetDirectory,
      blocType,
      stateType
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
async function promptForUseBloc(stateType:StateManagementType) :Promise<BlocType>{
  switch (stateType) {
    case StateManagementType.getx:
      return BlocType.Simple;
    case StateManagementType.bloc:
    case StateManagementType.cubit:
      return await promptForUseEquatable();
    default:
      return BlocType.Simple;
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
    // targetDirectory = await promptForTargetDirectory();
    targetDirectory = path.join(`${workspace.workspaceFolders![0].uri.fsPath}/lib/src`);
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

export async function promptForUseStateManagement ():  Promise<StateManagementType> {
  const usePromptValues: string[] = ["no (default)", "Cubit", "Bloc","GetX"];
  const usePromptOptions: QuickPickOptions = {
    placeHolder:
      "Do you want to use the State Management Package in bloc to override equality comparisons?",
    canPickMany: false,
  };

  const answer = await window.showQuickPick(
    usePromptValues,
    usePromptOptions
  );

  switch (answer) {
    case "Cubit":
      return StateManagementType.cubit;
    case "Bloc":
      return StateManagementType.bloc;
    case "GetX":
        return StateManagementType.getx;
    default:
      return StateManagementType.simple;
  }
}
// export async function promptForTargetDirectory (): Promise<string | undefined> {
//   const options: OpenDialogOptions = {
//     canSelectMany: false,
//     openLabel: "Select a folder to create the feature in",
//     canSelectFolders: true,
//   };

//   return window.showOpenDialog(options).then((uri) => {
//     if (_.isNil(uri) || _.isEmpty(uri)) {
//       return undefined;
//     }
//     return uri[0].fsPath;
//   });
// }

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
  state: StateManagementType,
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
  const whatStateManagementType = await stateNameFind(state);
  await createDirectories(presentationDirectoryPath, [
    whatStateManagementType,
    "Pages",
    "Widgets",
  ]);
    
  // Generate the bloc code in the presentation layer
  switch (state) {
    case StateManagementType.bloc:
      return await generateBlocCode(featureName, presentationDirectoryPath, type);
    case StateManagementType.cubit:
      return await generateCubitCode(featureName, presentationDirectoryPath, type);
    case StateManagementType.getx:
      return "GetX";
    default:
      return "";
  }
  // useCubit
  //   ? await generateCubitCode(featureName, presentationDirectoryPath, type)
  //   : await generateBlocCode(featureName, presentationDirectoryPath, type);
}


async function stateNameFind(type:StateManagementType): Promise<string > {
  switch (type) {
    case StateManagementType.bloc:
      return "Bloc";
    case StateManagementType.cubit:
      return "Cubit";
    case StateManagementType.getx:
      return "GetX";
    default:
      return "";
  }
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
///


export async function core (uri: Uri) {
	// Abort if name is not valid
	let targetDirectory = "";
  try {
    // targetDirectory = await getTargetDirectory(uri);
    // window.showInformationMessage(workspace.workspaceFolders?.find);
    targetDirectory = path.join(`${workspace.workspaceFolders![0].uri.fsPath}/lib/src`);

  } catch (error) {
    window.showErrorMessage(`error.message ${error}`);
  }
  try {
    await generateCoreArchitecture(targetDirectory);
    
  } catch (error) {
    window.showErrorMessage(
      `Error:
        ${error instanceof Error ? error.message : JSON.stringify(error)}`
    );
  }
}

export async function generateCoreArchitecture (targetDirectory: string) {

// Create the features directory if its does not exist yet
const coreDirectoryPath = getCoreDirectoryPath(targetDirectory);

		if (!existsSync(coreDirectoryPath)) {
		await createDirectories(coreDirectoryPath, [
			"Animation",
			"Api",
			"Config",
			"Constants",
			"Keys",
			"Error",
      "Network",
			"Routes",
			"Theme",
			"Utils",
			"Usecases",
			"Widgets",
			"Localization",
			"Middleware",
      'Global'
			]);	
      await Promise.all([
        // createRoutesTemplate(coreDirectoryPath),
        createTemplateFile(CoreType.animation,coreDirectoryPath),
        createTemplateFile(CoreType.api,coreDirectoryPath),
        createTemplateFile(CoreType.config,coreDirectoryPath),
        /// 
        createTemplateFile(CoreType.injection,coreDirectoryPath),
        createTemplateFile(CoreType.keyboard,coreDirectoryPath),
        createTemplateFile(CoreType.root,coreDirectoryPath),
        ///
        createTemplateFile(CoreType.constants,coreDirectoryPath),
        ///
        createTemplateFile(CoreType.color,coreDirectoryPath),
        createTemplateFile(CoreType.icon,coreDirectoryPath),
        createTemplateFile(CoreType.textStyle,coreDirectoryPath),
        ///
        createTemplateFile(CoreType.keys,coreDirectoryPath),
        createTemplateFile(CoreType.error,coreDirectoryPath),
        createTemplateFile(CoreType.network,coreDirectoryPath),
        createTemplateFile(CoreType.routes,coreDirectoryPath),
        ///
        createTemplateFile(CoreType.routeName,coreDirectoryPath),
        createTemplateFile(CoreType.routePage,coreDirectoryPath),
        ///
        createTemplateFile(CoreType.theme,coreDirectoryPath),
        createTemplateFile(CoreType.usecases,coreDirectoryPath),
        createTemplateFile(CoreType.utils,coreDirectoryPath),
        createTemplateFile(CoreType.widgets,coreDirectoryPath),
        createTemplateFile(CoreType.localization,coreDirectoryPath),
        createTemplateFile(CoreType.middleware,coreDirectoryPath),
        createTemplateFile(CoreType.global,coreDirectoryPath),
        //
        createMainFileTemplate(targetDirectory),
     
      ]);
			window.showInformationMessage(`Successfully Generated Core Folder.`);
		}
		else{
			window.showErrorMessage(`Error: Already Generated Core Folder!.`);
			return;
		}
	
  }

export function getCoreDirectoryPath (currentDirectory: string): string {
    // Split the path
    const splitPath = currentDirectory.split(path.sep);
    // Remove trailing \
    if (splitPath[splitPath.length - 1] === "") {
      splitPath.pop();
    }
    // Rebuild path
    const result = splitPath.join(path.sep);
    
    // If already return the current directory if not, return the current directory with the /features append to it
    return  path.join(result, "Core");
    }




async function  createTemplateFile (type: CoreType, dir: string) {
      
      const targetDir = await getTemplatePath(type,dir);

      const data = await getTemplate(type);

      if (existsSync(targetDir)) {
        throw Error(`File already exists`);
      }
      return new Promise(async (resolve, reject) => {
        writeFile(
          targetDir,
          data,
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

async function  createMainFileTemplate (dir: string) {
      
      // const targetPath = `${dir}/main.dart`;

      const targetPath  = path.join(`${workspace.workspaceFolders![0].uri.fsPath}/lib/main.dart`);

      if (!existsSync(targetPath)) {
        throw Error(`File is not find!`);
      }
      return new Promise(async (resolve, reject) => {
        writeFile(
          targetPath,
          getMainFileTemplate(),
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

