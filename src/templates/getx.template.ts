import * as changeCase from "change-case";
// import { BlocType } from "../utils";
import { existsSync, writeFile } from "fs";



export function createGetxControllerTemplate (
  getxName: string,
  targetDirectory: string
) {
  const snakeCaseGetXName = changeCase.snakeCase(getxName.toLowerCase());
  const controllertargetPath = `${targetDirectory}/getX/${snakeCaseGetXName}_controller.dart`;
  const statetargetPath = `${targetDirectory}/getX/${snakeCaseGetXName}_state.dart`;
  const servicegetPath = `${targetDirectory}/getX/${snakeCaseGetXName}_service.dart`;
  const bindinggetPath = `${targetDirectory}/getX/${snakeCaseGetXName}_binding.dart`;
  const getPath = `${targetDirectory}/getX/${snakeCaseGetXName}_getx.dart`;
  //
  if (existsSync(controllertargetPath)) {
    throw Error(`${snakeCaseGetXName}_controller.dart already exists`);
  }
  if (existsSync(statetargetPath)) {
    throw Error(`${snakeCaseGetXName}_state.dart already exists`);
  }
  if (existsSync(servicegetPath)) {
    throw Error(`${snakeCaseGetXName}_service.dart already exists`);
  }
  if (existsSync(bindinggetPath)) {
    throw Error(`${snakeCaseGetXName}_binding.dart already exists`);
  }
  if (existsSync(getPath)) {
    throw Error(`${snakeCaseGetXName}_getx.dart already exists`);
  }
  
  //
  return new Promise(async (resolve, reject) => {
    writeFile(
      controllertargetPath,
      getGetxControllerTemplate(getxName),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    ),
    writeFile(
      statetargetPath,
      getGetxStateTemplate(getxName),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    ),
    writeFile(
      servicegetPath,
      getGetxServiceTemplate(getxName),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    ),
    writeFile(
      bindinggetPath,
      getGetxBindingTemplate(getxName),
      "utf8",
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(true);
      }
    ),
    writeFile(
      getPath,
      getGetxTemplate(getxName),
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
function getGetxTemplate(getxName: string) {
  const snakeCaseGetxName = changeCase.snakeCase(getxName);
  return `
  library ${snakeCaseGetxName}_getx;
  export '${snakeCaseGetxName}_controller.dart';
  export '${snakeCaseGetxName}_service.dart';
  export '${snakeCaseGetxName}_state.dart';
  export '${snakeCaseGetxName}_binding.dart';
  `;
}
function getGetxControllerTemplate(getxName: string) {
  const pascalCaseGetxName = changeCase.pascalCase(getxName);
  return `
  import 'package:get/get.dart'; 
  class ${pascalCaseGetxName}Controller extends GetxController {
  }
  `;
}
function getGetxServiceTemplate(getxName: string) {
  const pascalCaseGetxName = changeCase.pascalCase(getxName);
  return `
  import 'package:get/get.dart'; 
  class ${pascalCaseGetxName}Service extends GetxService {
  }
  `;
}
function getGetxStateTemplate(getxName: string) {
  const pascalCaseGetxName = changeCase.pascalCase(getxName);
  return `
  import 'package:get/get.dart'; 
  class ${pascalCaseGetxName}State extends GetXState {
  }
  `;
}

function getGetxBindingTemplate(getxName: string) {
  const pascalCaseGetxName = changeCase.pascalCase(getxName);
  const snakeCaseGetxName = changeCase.snakeCase(getxName);
  return `
  import 'package:get/get.dart'; 
  import '${snakeCaseGetxName}_controller.dart';

  class ${pascalCaseGetxName}Binding implements Bindings {
    @override
    void dependencies() => Get.lazyPut(() => ${pascalCaseGetxName}Controller());
  }
  `;
}
