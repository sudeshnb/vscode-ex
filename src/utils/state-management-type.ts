export const enum StateManagementType {
    simple,
    bloc,
    getx,
    cubit,
  }

//   export async function getBlocType(type: StateManagementType): Promise<StateManagementType> {
    
//     switch (type) {
//       case StateManagementType.bloc:
//         return BlocType.Freezed;
//       case StateManagementType.cubit:
//         return BlocType.Equatable;
//       case StateManagementType.getx:
//         return BlocType.Simple;
//       case StateManagementType.simple:
//       default:
//         return getDefaultDependency();
//     }
//   }
//   async function getDefaultDependency(): Promise<StateManagementType> {
//     if (await hasDependency(getx)) {
//       return StateManagementType.getx;
//     } else if (await hasDependency(bloc)) {
//       return StateManagementType.bloc;
//     } else {
//       return StateManagementType.simple;
//     }
//   }