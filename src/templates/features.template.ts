
function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

export async function getFeaturesTemplate(type: String, featureName: string): Promise<NodeJS.ArrayBufferView | string > {
   
    var name = capitalizeFirstLetter(featureName);

    switch (type) {
        case "sources":
            return getRemoteSourcesTemplate(name);
        case "models":
            return getModelsTemplate(name);
        case "implements":
            return getDataRepositoriesTemplate(name);
        case "entities":
            return getEntitiesTemplate(name);
        case "repositories":
            return getDomainRepositoriesTemplate(name);
        case "pages":
            return getPageTemplate(name);   
        case "usecases":
            return getUsecasesTemplate(name);
        case "widgets":
            return getWidgetsTemplate();
        default:
            return getGlobalTemplate();
    }
}
// 
function getRemoteSourcesTemplate(value:String): NodeJS.ArrayBufferView | string {
    return ` 
    class  ${value}RemoteDataSource {
        // Make API call to fetch data and return object.
        // ...
    }`;
  }
  // 
function getLocalSourcesTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    class LocalDataSource {
        // Make LOCAL call to fetch data and return object.
        // ...
    }`;
  }
// 
function getModelsTemplate(value:String): NodeJS.ArrayBufferView | string {
    return ` 
    class  ${value}Model {
        // ...
        // A model is a more generic term and can represent structured data used within an application. 
        // ...
        // fromJson
        // ...
        // toJson
   
    }`;
  }
// 
function getDataRepositoriesTemplate(value:String): NodeJS.ArrayBufferView | string {
    return `
    import '../sources/sources.dart';
    import '../../domain/repositories/repositories.dart';
    
    class ${value}RepositoryImp implements ${value}Repository{

        final ${value}RemoteDataSource remoteDataSource;
        ${value}RepositoryImp({required this.remoteDataSource});
      
        // ... example ...
        //
        // Future<User> getUser(String userId) async {
        //     return remoteDataSource.getUser(userId);
        //   }
        // ...
    }
    `;
  }

// 
function getWidgetsTemplate(): NodeJS.ArrayBufferView | string {
    return `library widgets;`;
  }

// 
function getGlobalTemplate(): NodeJS.ArrayBufferView | string {
    return `library global;`;
  }
//
function getEntitiesTemplate(value:String): NodeJS.ArrayBufferView | string {
    return `
    class ${value}Entity {
        // ...
        // An entity represents a real-world object with a distinct identity. 
    }
    `;
  }
//
function getPageTemplate(value:String): NodeJS.ArrayBufferView | string {
    return `
    import 'package:flutter/material.dart';
    class ${value}Page extends StatelessWidget {
        const ${value}Page({Key? key}) : super(key: key);
      
        @override
        Widget build(BuildContext context) {
          return Scaffold(
            appBar: AppBar(
              title: Text('${value} Page'),
            ),
            );
            }
        }
    `;
}

//
function getUsecasesTemplate(value:String): NodeJS.ArrayBufferView | string {
    return ` 
    import '../repositories/repositories.dart';

    class Get${value}UseCase {
        final ${value}Repository repository;
      
        Get${value}UseCase({required this.repository});
      
        // Future<User> execute(String userId) async {
        //   return userRepository.getUser(userId);
        // }
      }
      `;
}

//
 function getDomainRepositoriesTemplate(value:String): NodeJS.ArrayBufferView | string {
    return ` 
    abstract class ${value}Repository {
        // Future<User> getUser(String userId);
      }
    `;
}