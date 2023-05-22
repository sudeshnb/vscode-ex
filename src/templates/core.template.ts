export const enum CoreType {
    api,
    animation,
    config,
    injection,
    root,
    keyboard,
    constants,
    color,
    icon,
    textStyle,
	keys,
	error,
    services,
	routes,
    routeName,
    routePage,
	theme,
	utils,
	usecases,
	widgets,
    localization,
	middleware,
    global
  }

  export async function getTemplatePath(type: CoreType,dir: string) : Promise<string> {
    switch (type) {
        case CoreType.animation:
            return `${dir}/Animation/animation.dart`;
        case CoreType.api:
            return `${dir}/Api/api.dart`;
        case CoreType.config:
            return `${dir}/Config/config.dart`;
        case CoreType.injection:
            return `${dir}/Config/injection.dart`;
        case CoreType.root:
            return `${dir}/Config/root_app.dart`;
        case CoreType.keyboard:
            return `${dir}/Config/keyboard.dart`;
        case CoreType.constants:
            return `${dir}/Constants/constants.dart`;
        case CoreType.color:
            return `${dir}/Constants/colors.dart`;
        case CoreType.icon:
            return `${dir}/Constants/icons.dart`;
        case CoreType.textStyle:
            return `${dir}/Constants/text_style.dart`;
        case CoreType.keys:
          return `${dir}/Keys/keys.dart`;
        case CoreType.error:
            return `${dir}/Error/error.dart`;
        case CoreType.services:
            return `${dir}/Services/services.dart`;
        case CoreType.routes:
            return `${dir}/Routes/routes.dart`;
        case CoreType.routeName:
            return `${dir}/Routes/names.dart`;
        case CoreType.routePage:
            return `${dir}/Routes/pages.dart`;
        case CoreType.theme:
            return `${dir}/Theme/theme.dart`;
        case CoreType.utils:
            return `${dir}/Utils/utils.dart`;
        case CoreType.usecases:
            return `${dir}/Usecases/usecases.dart`;
        case CoreType.widgets:
            return `${dir}/Widgets/widgets.dart`;
        case CoreType.localization:
            return `${dir}/Localization/localization.dart`;
        case CoreType.middleware:
            return `${dir}/Middleware/middleware.dart`;
        default:
            return `${dir}/Global/global.dart`;
    }

}



export async function getTemplate(type: CoreType): Promise<NodeJS.ArrayBufferView | string > {
   
    switch (type) {
        case CoreType.animation:
            return getAnimationTemplate();
        case CoreType.api:
            return getApiTemplate();
        case CoreType.config:
            return getConfigTemplate();
        case CoreType.config:
            return getInjectionTemplate();
        case CoreType.keyboard:
            return getKeyboardTemplate();
        case CoreType.root:
            return getRootAppTemplate();
        case CoreType.constants:
            return getConstantsTemplate();
        case CoreType.color:
            return getColorTemplate();
        case CoreType.icon:
            return getIconsTemplate();
        case CoreType.textStyle:
            return getTextStyleTemplate();
        case CoreType.keys:
          return getKeysTemplate();
        case CoreType.error:
            return getErrorTemplate();
        case CoreType.services:
            return getNetworkTemplate();
        case CoreType.routes:
            return getRoutesTemplate();
        case CoreType.routeName:
            return getRouteNamesTemplate();
        case CoreType.routePage:
            return getRoutePagesTemplate();
        case CoreType.theme:
            return getThemeTemplate();
        case CoreType.utils:
            return getUtilsTemplate();
        case CoreType.usecases:
            return getUsecasesTemplate();
        case CoreType.widgets:
            return getWidgetsTemplate();
        case CoreType.localization:
            return getLocalizationTemplate();
        case CoreType.middleware:
            return getMiddlewareTemplate();
        default:
            return getGlobalTemplate();
    }
}
// 
function getAnimationTemplate(): NodeJS.ArrayBufferView | string {
    return `library animation;`;
  }
// 
function getApiTemplate(): NodeJS.ArrayBufferView | string {
    return `library api;`;
  }
// 
function getConfigTemplate(): NodeJS.ArrayBufferView | string {
    return `
    library config;
    export 'injection.dart';
    export 'keyboard.dart';
    export 'root_app.dart';
    `;
  }
// 
function getConstantsTemplate(): NodeJS.ArrayBufferView | string {
    return `
    library constants;
    export 'colors.dart';
    export 'icons.dart';
    export 'text_style.dart';
    `;
  }
// 
function getKeysTemplate(): NodeJS.ArrayBufferView | string {
    return `library keys;`;
  }
// 
function getErrorTemplate(): NodeJS.ArrayBufferView | string {
    return `library error;`;
  }
// 
function getNetworkTemplate(): NodeJS.ArrayBufferView | string {
    return `library services;`;
  }
// 
function getThemeTemplate(): NodeJS.ArrayBufferView | string {
    return `library theme;`;
  }
// 
function getLocalizationTemplate(): NodeJS.ArrayBufferView | string {
    return `library localization;`;
  }
// 
function getUsecasesTemplate(): NodeJS.ArrayBufferView | string {
    return `library usecases;`;
  }
// 
function getWidgetsTemplate(): NodeJS.ArrayBufferView | string {
    return `library widgets;`;
  }
// 
function getUtilsTemplate(): NodeJS.ArrayBufferView | string {
    return `library utils;`;
  }
// 
function getMiddlewareTemplate(): NodeJS.ArrayBufferView | string {
    return `library middleware;`;
  }
// 
function getGlobalTemplate(): NodeJS.ArrayBufferView | string {
    return `library global;`;
  }
//
function getRoutesTemplate(): NodeJS.ArrayBufferView | string {
    return `
    library global;
    export 'names.dart';
    export 'pages.dart';
    `;
  }
//
//
function getRouteNamesTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    library route_names;
    class AppRoutes {
        static const initial = '/';
        static const home = '/home';
        static const login = '/login';
    }`;
  }
//   
function getRoutePagesTemplate(): NodeJS.ArrayBufferView | string {
    return `
    library route_pages;
    import 'routes.dart';        
    class AppRoutePages {
        static const initial = AppRoutes.initial;
        static final List routes = [];
    }`;
  }
//
function getInjectionTemplate(): NodeJS.ArrayBufferView | string {
    return `
    library dependency_injection;
    import 'package:flutter/material.dart';
    class DependencyInjection {
        static Future<void> init() async {
            WidgetsFlutterBinding.ensureInitialized();
        }
    }`;
  }
//
function getColorTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    library app_colors;
    import 'package:flutter/material.dart';
    class AppColor {

        static Color black = const Color(0xFF000000);
        static Color white = const Color(0xFFFFFFFF);

    }`;
}
//
function getIconsTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    library app_icons;
    import 'package:flutter/material.dart';
    class AppIcons {

        static const String opps = "assets/svg/opps.svg";
        static const String wifi = "assets/svg/wifi.svg";

    }`;
}
//
function getTextStyleTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    library text_style;
    import 'package:flutter/material.dart';
    // 
    mixin Font implements FontWeight  {
        static FontWeight get l => FontWeight.w300;
        static FontWeight get n => FontWeight.w400;
        static FontWeight get sb => FontWeight.w500;
        static FontWeight get b => FontWeight.w700;
    }
    // 
    class class AppTextStyle extends TextStyle {

        static TextStyle get header => TextStyle();
    }`;
}
//
function getKeyboardTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    library app_keyboard;
    import 'package:flutter/material.dart';
    class DismissKeyboard extends StatelessWidget {
        final Widget child;
        const DismissKeyboard({super.key, required this.child});
      
        @override
        Widget build(BuildContext context) {
          return GestureDetector(
            onTap: () {
              FocusScopeNode currentFocus = FocusScope.of(context);
              if (!currentFocus.hasPrimaryFocus &&
                  currentFocus.focusedChild != null) {
                FocusManager.instance.primaryFocus!.unfocus();
              }
            },
            child: child,
          );
        }
      }`;
}
//
export function getMainFileTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    import 'src/Core/Config/config.dart';
    import 'package:flutter/material.dart';
    Future<void> main() async {
        //  Here we are calling the Dependency Injection
        await DependencyInjection.init();
        //  This is the main app
        runApp(const RootApp());
    }
    `;
}
//
export function getRootAppTemplate(): NodeJS.ArrayBufferView | string {
    return ` 
    import 'keyboard.dart';
    import 'package:flutter/material.dart';
    import 'package:flutter_screenutil/flutter_screenutil.dart';

    class RootApp extends StatelessWidget {
        RootApp({required this.child});
      
        final Widget child;
      
        @override
        Widget build(BuildContext context) {
          return ScreenUtilInit(
            designSize: const Size(360, 690),
            minTextAdapt: true,
            splitScreenMode: true,
            builder: (context, ch) => DismissKeyboard(child: child),
          );
        }
      }
    `;
}