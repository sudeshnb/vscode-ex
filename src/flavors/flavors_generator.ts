
import * as fs from "fs";
import * as path from "path";
import { workspace} from "vscode";



export async function appendFlavors(){
  
   await findBuildGradleFile();

  
}


 async function findBuildGradleFile(){
    let targetDir = "";
    targetDir = path.join(`${workspace.workspaceFolders![0].uri.fsPath}/android/app/`);

   await createFlavorsTemplate(targetDir);

    // var content = fs.readFileSync('build', 'utf8');
    // content = content.replace(/\/\/\/ ,?/g, '.gradle');
}


 function insertFlavors():string {
 
    let method =  "flavorDimensions"+ '"default"';
    method += '\n';
    method += 'productFlavors {';
    method += '\n';
    method += 'production {';
    method += '\n';
    method += 'dimension "default"';
    method += '\n';
    method += 'applicationIdSuffix ""';
    method += '\n';
    method += 'manifestPlaceholders = [appName: "App"]';
    method += '\n';
    method += '}';
    method += '\n';

    method += 'staging {';
    method += '\n';
    method += 'dimension "default"';
    method += '\n';
    method += 'applicationIdSuffix ".stg"';
    method += '\n';
    method += 'manifestPlaceholders = [appName: "[STG] App"]';
    method += '\n';
    method += '}';
    method += '\n';
        
    method += 'development {';
    method += '\n';
    method += 'dimension "default"';
    method += '\n';
    method += 'applicationIdSuffix ".dev"';
    method += '\n';
    method += 'manifestPlaceholders = [appName: "[DEV] App"]';
    method += '\n';
    method += '}';
    method += '\n';

    method += '}';

    return method;
 }



function createFlavorsTemplate ( targetDirectory: string){

    const targetPath = `${targetDirectory}/build.gradle`;

    var content = fs.readFileSync(targetPath, 'utf8');
    
    if (content !== null && content.includes('android {')) {

        for (const line of content.split('\n')) {

            if (line.startsWith('android { ')) {

                content += insertFlavors();
                break;
            }
        }
    }
   
    return new Promise(async (resolve, reject) => {
      fs.writeFile(
        targetPath,
        insertFlavors(),
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

   async function findProjectName() :Promise<string>{
    const gradle = await workspace.findFiles('android/app/build.gradle');
    var content ='';
    if (gradle !== null && gradle.length > 0) {
        const pubspec = gradle[0];
         content = fs.readFileSync(pubspec.fsPath, 'utf8');
        if (content !== null && content.includes('android {')) {
            for (const line of content.split('\n')) {
                if (line.startsWith('android { ')) {
                    content += insertFlavors();
                    break;
                }
            }
        }
    }
    return content;
}

