import * as _ from "lodash";
import * as changeCase from "change-case";
import * as mkdirp from 'mkdirp';
import * as path from "path";

import {
  commands,
  ExtensionContext,
  InputBoxOptions,
  QuickPickOptions,
  Uri,
  window,
  workspace,
  languages,
  CodeActionKind,
  
} from "vscode";

import { existsSync, lstatSync, writeFile } from "fs";
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
  getRootAppTemplate,
  createGetxControllerTemplate,
  getFeaturesTemplate,
} from "./templates";
import { analyzeDependencies } from "./utils";
import { BlocType ,StateManagementType} from "./utils";

import  * as s from "./class_generator";

import  {appendFlavors} from "./flavors";



export function activate (_context: ExtensionContext) {
  analyzeDependencies();
  // ntsukiqqv66yzv32hwxgeomoiv63tffr5ikwk6ufbzkx3cdnlyxa
  commands.registerCommand("onyxsio.flavors", async (uri: Uri) => {
    flavorsCommand();
    
  });
  commands.registerCommand("onyxsio.new-feature", async (uri: Uri) => {
    mainCommand(uri);
    
  });

  commands.registerCommand("onyxsio.new-core", async (uri: Uri) => {
    core();
  });

  commands.registerCommand("onyxsio.package", async (uri: Uri) => {
    packageFolder();
  });
  ///
  _context.subscriptions.push(
    commands.registerCommand('onyxsio.props',s.generateDataClass
    ));
  ///
  _context.subscriptions.push(
    commands.registerCommand('onyxsio.json',s.generateJsonDataClass
      ));
  //
  _context.subscriptions.push(languages.registerCodeActionsProvider({
      language: 'dart',
      scheme: 'file'
    },(new s.DataClassCodeActions()),  {
      providedCodeActionKinds: [
        CodeActionKind.QuickFix
      ],
    }));
    //
    s.findProjectName();
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

 
 
  const pascalCaseFeatureName = changeCase.pascalCase(featureName.toLowerCase());

  const snakeCaseName = changeCase.snakeCase(featureName.toLowerCase());
  try {
    await generateFeatureArchitecture(
      // `${featureName}`,
      `${snakeCaseName}`,
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
  const blocDirectoryPath = `${targetDirectory}/bloc`;
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
  const blocDirectoryPath = `${targetDirectory}/cubit`;
  if (!existsSync(blocDirectoryPath)) {
    await createDirectory(blocDirectoryPath);
  }

  await Promise.all([
    createCubitStateTemplate(blocName, targetDirectory, type),
    createCubitTemplate(blocName, targetDirectory, type),
  ]);
}
async function generateGetXCode (
  getxName: string,
  targetDirectory: string
) {
  const getxDirectoryPath = `${targetDirectory}/getX`;
  if (!existsSync(getxDirectoryPath)) {
    await createDirectory(getxDirectoryPath);
  }

  await Promise.all([
    createGetxControllerTemplate(getxName, targetDirectory),
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
  const dataDirectoryPath = path.join(featureDirectoryPath, "data");
  await createDirectories(dataDirectoryPath, [
    "sources",
    "models",
    "implements",
  ],featureName);

  // Create the domain layer
  const domainDirectoryPath = path.join(featureDirectoryPath, "domain");
  await createDirectories(domainDirectoryPath, [
    "entities",
    "repositories",
    "usecases",
  ],featureName);

  // Create the presentation layer
  const presentationDirectoryPath = path.join(
    featureDirectoryPath,
    "presentation"
  );
  const whatStateManagementType = await stateNameFind(state);
  await createDirectories(presentationDirectoryPath, [
    whatStateManagementType,
    "pages",
    "widgets",
  ],featureName);
    
  // Generate the bloc code in the presentation layer
  switch (state) {
    case StateManagementType.bloc:
      return await generateBlocCode(featureName, presentationDirectoryPath, type);
    case StateManagementType.cubit:
      return await generateCubitCode(featureName, presentationDirectoryPath, type);
    case StateManagementType.getx:
      return await generateGetXCode(featureName, presentationDirectoryPath);
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
      return "bloc";
    case StateManagementType.cubit:
      return "cubit";
    case StateManagementType.getx:
      return "getX";
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
    splitPath[splitPath.length - 1] === "features";

  // If already return the current directory if not, return the current directory with the /features append to it
  return isDirectoryAlreadyFeatures ? result : path.join(result, "features");
}

export async function createDirectories (
  targetDirectory: string,
  childDirectories: string[],
  featureName: string,
): Promise<void> {
  // Create the parent directory
  await createDirectory(targetDirectory);
  // Creat the children
  childDirectories.map(
    async (directory) =>
     { await createDirectory(path.join(targetDirectory, directory));

      if(directory != ""){
      createFeatureTemplate(directory,path.join(targetDirectory, directory),featureName);}
    }
  );
}
export async function createCoreDirectories (
  targetDirectory: string,
  childDirectories: string[],
  
): Promise<void> {
  // Create the parent directory
  await createDirectory(targetDirectory);
  // Creat the children
  childDirectories.map(
    async (directory) =>
     { await createDirectory(path.join(targetDirectory, directory));
    }
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

async function createFeatureTemplate (
  blocName: string,
  targetDirectory: string,
  featureName: string,
) {
  const snakeCaseBlocName = changeCase.snakeCase(blocName.toLowerCase());
  const targetPath = `${targetDirectory}/${snakeCaseBlocName}.dart`;
  const data = await getFeaturesTemplate(snakeCaseBlocName,featureName);
  if (existsSync(targetPath)) {
    throw Error(`${snakeCaseBlocName}.dart already exists`);
  }
  return new Promise(async (resolve, reject) => {
    writeFile(
      targetPath,
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

function createBlocEventTemplate (
  blocName: string,
  targetDirectory: string,
  type: BlocType
) {
  const snakeCaseBlocName = changeCase.snakeCase(blocName.toLowerCase());
  const targetPath = `${targetDirectory}/bloc/${snakeCaseBlocName}_event.dart`;
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
  const targetPath = `${targetDirectory}/bloc/${snakeCaseBlocName}_state.dart`;
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
  const targetPath = `${targetDirectory}/bloc/${snakeCaseBlocName}_bloc.dart`;
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
  const targetPath = `${targetDirectory}/cubit/${snakeCaseBlocName}_state.dart`;
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
  const targetPath = `${targetDirectory}/cubit/${snakeCaseBlocName}_cubit.dart`;
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
export async function flavorsCommand () {
	// Abort if name is not valid
	let libDir = "";
	let iOSDir = "";
	let androidDir = "";


  try {
    // targetDirectory = await getTargetDirectory(uri);
    var fsPath=workspace.workspaceFolders![0].uri.fsPath;
  
    libDir = path.join(`${fsPath}/lib`);
    androidDir = path.join(`${fsPath}/android/app/src`);
    iOSDir = path.join(`${fsPath}/ios/config`);


  } catch (error) {
    window.showErrorMessage(`error: ${error}`);
  }
  try {

    await appendFlavors();
    // await generateFlavorArchitecture(targetiOSDirectory);
    // await generateFlavorArchitecture(targetAndroidDirectory);
    // await generateFlavorArchitecture(targetLibDirectory);
    
  } catch (error) {
    window.showErrorMessage(
      `Error:
        ${error instanceof Error ? error.message : JSON.stringify(error)}`
    );
  }
}
export async function core () {
	// Abort if name is not valid
	let targetDirectory = "";
  try {
    
    targetDirectory = path.join(`${workspace.workspaceFolders![0].uri.fsPath}/lib/src`);

  } catch (error) {
    window.showErrorMessage(`error: ${error}`);
  }
  try {
    await generateCoreArchitecture(targetDirectory);
    
  } catch (error) {
    window.showErrorMessage(
      `Error: ${error instanceof Error ? error.message : JSON.stringify(error)}`
    );
  }
}

 async function generateFlavorArchitecture (targetDir: string) {

  // Create the features directory if its does not exist yet
  const dirPath = checkDirectoryPath(targetDir,"");
  
      if (!existsSync(dirPath)) {

      await createCoreDirectories(dirPath, ["development","staging","production"]);	
      
        window.showInformationMessage(`Successfully Generated Flavors Folder.`);
      }
      else{
        window.showErrorMessage(`Error: Already Generated Flavors Folder!.`);
        // return;
      }
    
}

async function generateCoreArchitecture (targetDir: string) {

// Create the features directory if its does not exist yet
const coreDirPath = checkDirectoryPath(targetDir, "core");

		if (!existsSync(coreDirPath)) {
		await createCoreDirectories(coreDirPath, [
			"animation",
			"api",
			"config",
			"constants",
			"keys",
			"error",
      "services",
			"routes",
			"theme",
			"utils",
			"usecases",
			"widgets",
			"localization",
			"middleware",
      'global'
			]);	
      
      await Promise.all([
       
        createTemplateFile(CoreType.animation,coreDirPath),
        createTemplateFile(CoreType.api,coreDirPath),
        createTemplateFile(CoreType.config,coreDirPath),
        createTemplateFile(CoreType.injection,coreDirPath),
        createTemplateFile(CoreType.keyboard,coreDirPath),
        createTemplateFile(CoreType.constants,coreDirPath),
        createTemplateFile(CoreType.color,coreDirPath),
        createTemplateFile(CoreType.icon,coreDirPath),
        createTemplateFile(CoreType.textStyle,coreDirPath),
        createTemplateFile(CoreType.keys,coreDirPath),
        createTemplateFile(CoreType.error,coreDirPath),
        createTemplateFile(CoreType.services,coreDirPath),
        createTemplateFile(CoreType.routes,coreDirPath),
        ///
        createTemplateFile(CoreType.routeName,coreDirPath),
        createTemplateFile(CoreType.routePage,coreDirPath),
        ///
        createTemplateFile(CoreType.theme,coreDirPath),
        createTemplateFile(CoreType.usecases,coreDirPath),
        createTemplateFile(CoreType.utils,coreDirPath),
        createTemplateFile(CoreType.widgets,coreDirPath),
        createTemplateFile(CoreType.localization,coreDirPath),
        createTemplateFile(CoreType.middleware,coreDirPath),
        createTemplateFile(CoreType.global,coreDirPath),
        //
        createMainFileTemplate(),
     
      ]);
			window.showInformationMessage(`Successfully Generated Core Folder.`);
		}
		else{
			window.showErrorMessage(`Error: Already Generated Core Folder!.`);
			return;
		}
	
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

async function  createMainFileTemplate () {
      
      const fsPath = workspace.workspaceFolders![0].uri.fsPath;
      const targetPath  = path.join(`${fsPath}/lib/main.dart`);
      const rootPath  = path.join(`${fsPath}/lib/re_name.dart`);

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
        writeFile(
          rootPath,
          getRootAppTemplate(),
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

export async function packageFolder () {
	// Abort if name is not valid
	let targetDirectory = "";
  try {
  
    targetDirectory = path.join(`${workspace.workspaceFolders![0].uri.fsPath}/packages`);

  } catch (error) {
    window.showErrorMessage(`error: ${error}`);
  }
  try {
    await generatePackageArchitecture(targetDirectory);
    
  } catch (error) {
    window.showErrorMessage(
      `Error:
        ${error instanceof Error ? error.message : JSON.stringify(error)}`
    );
  }
}


async function generatePackageArchitecture (targetDir: string) {

  // Create the features directory if its does not exist yet
  const packageDirPath = checkDirectoryPath(targetDir, "packages");
  
      if (!existsSync(packageDirPath)) {
      await createCoreDirectories(packageDirPath, [
        "auth",
        "config",
        'onyxsio'
        ]);	
        await Promise.all([createMainFileTemplate()]);
        window.showInformationMessage(`Successfully Generated Core Folder.`);
      }
      else{
        window.showErrorMessage(`Error: Already Generated Core Folder!.`);
        return;
      }
    
    }


    function checkDirectoryPath (dir: string,p: string): string {
      // Split the path
      const splitPath = dir.split(path.sep);
      // Remove trailing \
      if (splitPath[splitPath.length - 1] === "") {
        splitPath.pop();
      }
      // Rebuild path
      const result = splitPath.join(path.sep);
      // If already return the current directory if not, return the current directory with append to it
      return  path.join(result, p);
    }