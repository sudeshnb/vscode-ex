import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
// import common = require("mocha/lib/interfaces/common");
var projectName = '';
var isFlutter = false;


export async function findProjectName() {
    const pubspecs = await vscode.workspace.findFiles('pubspec.yaml');
    if (pubspecs !== null && pubspecs.length > 0) {
        const pubspec = pubspecs[0];
        const content = fs.readFileSync(pubspec.fsPath, 'utf8');
        if (content !== null && content.includes('name: ')) {
            isFlutter = content.includes('flutter:') && content.includes('sdk: flutter');
            for (const line of content.split('\n')) {
                if (line.startsWith('name: ')) {
                    projectName = line.replace('name:', '').trim();
                    break;
                }
            }
        }
    }
}

export async function generateJsonDataClass() {
    let langId = getLangId();
    if (langId === 'dart') {
        let document = getDocText();

        const name = await vscode.window.showInputBox({
            placeHolder: 'Please type in a class name.'
        });

        if (name === null || name!.length === 0) {
            return;
        }
        let reader = new JsonReader(document, name!);
        let seperate = true;

        if (await reader.error === null) {
            if (reader.files.length >= 2) {
                const setting = readSetting('json.seperate');
                if (setting === 'ask') {
                    const r = await vscode.window.showQuickPick(['Yes', 'No'], {
                        canPickMany: false,
                        placeHolder: 'Do you wish to seperate the JSON into multiple files?'
                    });

                    if (r !== null) {
                        seperate = r === 'Yes';
                    } else {
                        return;
                    }
                } else {
                    seperate = setting === 'seperate';
                }
            }

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                cancellable: false
            }, async function (progress, token) {
                progress.report({ increment: 0, message: 'Generating Data Classes...' });
                scrollTo(0,0);
                await reader.commitJson(progress, seperate);
                clearSelection();
            });
        } else {
            showError(await reader.error);
        }
    } else if (langId === 'json') {
        showError('Please paste the JSON directly into an empty .dart file and then try again!');
    } else {
        showError('Make sure that you\'re editing a dart file and then try again!');
    }
}

export async function generateDataClass(text = getDocText()) {
    if (getLangId() === 'dart') {
        const generator = new DataClassGenerator(text);
        let clazzes = generator.clazzes;

        if (clazzes!.length === 0) {
            showError('No convertable dart classes were detected!');
            return null;
        } else if (clazzes!.length >= 2) {
            // Show a prompt if there is more than one class in the current editor.
            clazzes = await showClassChooser(clazzes!);
            if (clazzes === null) {
                showInfo('No classes selected!');
                return;
            }
        }

        for (let clazz of clazzes!) {
            if (clazz.isValid && clazz.toReplace.length > 0) {
                if (readSetting('override.manual')) {
                    // When manual overriding is activated ask for every override.
                    let result = [];
                    for (let replacement of clazz.toReplace) {
                        const r = await vscode.window.showQuickPick(['Yes', 'No'], {
                            placeHolder: `Do you want to override ${replacement.name}?`,
                            canPickMany: false
                        });

                        if (r === null) {
                            showInfo('Canceled!');
                            return;
                        } else if ('Yes' === r) {result.push(replacement);}
                    }
                    clazz.toReplace = result;
                }
            }
        }

        const edit = getReplaceEdit(clazzes, generator.imports, true);
        await vscode.workspace.applyEdit(edit);

        clearSelection();

        return clazzes;
    } else {
        showError('Make sure that you\'re editing a dart file and then try again!');
        return null;
    }
}

export async function showClassChooser(clazzez: DartClass[]) {
    const values = clazzez.map((v) => v.name!);

    const r = await vscode.window.showQuickPick(values, {
        placeHolder: 'Please select the classes you want to generate data classes of.',
        canPickMany: true,
    });

    let result = [];
    if (r !== null && r!.length > 0) {
        for (let c of r!) {
            for (let clazz of clazzez) {
                if (clazz.name === c)
                    {result.push(clazz);}
            }
        }
    } else {return null;}

    return result;
}

export class DartClass {
    name: string|null;
    fullGenericType:string;
    superclass:string|null;
    interfaces:string[];
    mixins:string[];
    constr:string|null;
    properties:ClassField[];
    startsAtLine:number | null;
    endsAtLine:number | null;
    constrStartsAtLine: number | null;
    constrEndsAtLine:number|null;
    constrDifferent:boolean;
    isArray:boolean;
    isLastInFile:boolean;
    classContent:string;
    toInsert:string;
    toReplace:ClassPart[];
    //
    constructor() {
       
        this.name = null;
        this.fullGenericType = '';
        this.superclass = null;
        this.interfaces = [];
        this.mixins = [];
        this.constr = null;
        this.properties = [];
        this.startsAtLine = null;
        this.endsAtLine = null;
        this.constrStartsAtLine = null;
        this.constrEndsAtLine = null;
        this.constrDifferent = false;
        this.isArray = false;
        this.classContent = '';
        this.toInsert = '';
        this.toReplace = [];
        this.isLastInFile = false;
    }

    get type():string {
        return this.name + this.genericType;
    }

    get genericType():string {
        const parts = this.fullGenericType.split(',');
        return parts.map((type) => {
            let part = type.trim();
            if (part.includes('extends')) {
                part = part.substring(0, part.indexOf('extends')).trim();
                if (type === parts[parts.length - 1]) {
                    part += '>';
                }
            }
            return part;
        }).join(', ');
    }

    get propsEndAtLine():number {
        if (this.properties.length > 0) {
            return this.properties[this.properties.length - 1].line;
        } else {
            return -1;
        }
    }

    get hasSuperclass() :boolean{
        return this.superclass !== null;
    }

    get classDetected():boolean {
        return this.startsAtLine !== null;
    }

    get didChange():boolean {
        return this.toInsert.length > 0 || this.toReplace.length > 0 || this.constrDifferent;
    }

    get hasNamedConstructor():boolean {
        if (this.constr !== null) {
            return this.constr.replace('const', '').trimStart().startsWith(this.name + '({');
        }
        return true;
    }

    get hasConstructor():boolean {
        return this.constrStartsAtLine !== null && this.constrEndsAtLine !== null && this.constr !== null;
    }

    get hasMixins():boolean {
        return this.mixins !== null && this.mixins.length > 0;
    }

    get hasInterfaces():boolean {
        return this.interfaces !== null && this.interfaces.length > 0;
    }

    get hasEnding():boolean {
        return this.endsAtLine !== null;
    }

    get hasProperties():boolean {
        return this.properties.length > 0;
    }

    get fewProps():boolean {
        return this.properties.length <= 3;
    }

    get isValid():boolean {
        return this.classDetected && this.hasEnding && this.hasProperties && this.uniquePropNames;
    }

    get isWidget():boolean {
        return this.superclass !== null && (this.superclass === 'StatelessWidget' || this.superclass === 'StatefulWidget');
    }

    get isStatelessWidget():boolean {
        return this.isWidget && this.superclass !== null && this.superclass === 'StatelessWidget';
    }

    get isState():boolean {
        return !this.isWidget && this.superclass !== null && this.superclass.startsWith('State<');
    }

    get isAbstract():boolean {
        return this.classContent.trimStart().startsWith('abstract class');
    }

    get usesEquatable():boolean {
        return (this.hasSuperclass && this.superclass === 'Equatable') || (this.hasMixins && this.mixins.includes('EquatableMixin'));
    }

    get issue():string {
        const def = this.name + ' couldn\'t be converted to a data class: ';
        let msg = def;
        if (!this.hasProperties) {
            msg += 'Class must have at least one property!';
        } else if (!this.hasEnding) {
            msg += 'Class has no ending!';
        } else if (!this.uniquePropNames) {
            msg += 'Class doesn\'t have unique property names!';
        } else {
            msg = removeEnd(msg, ': ') + '.';
        }

        return msg;
    }

    get uniquePropNames():boolean {
        let props:any = [];
        for (let p of this.properties) {
            const n = p.name;
            if (props.includes(n))
                {return false;}
            props.push(n);
        }
        return true;
    }

    replacementAtLine(line:number) {
        for (let part of this.toReplace) {
            if (part.startsAt! <= line && part.endsAt! >= line) {
                return part.replacement;
            }
        }
        return null;
    }

    generateClassReplacement() {
        let replacement = '';
        let lines = this.classContent.split('\n');

        for (let i = this.endsAtLine! - this.startsAtLine!; i >= 0; i--) {
            let line = lines[i] + '\n';
            let l = this.startsAtLine! + i;

            if (i === 0) {
                const classType = this.isAbstract ? 'abstract class' : 'class';
                let classDeclaration = classType + ' ' + this.name + this.fullGenericType;
                if (this.superclass !== null) {
                    classDeclaration += ' extends ' + this.superclass;
                }

                function addSuperTypes(list:string[], keyword:string) {
                    if (list.length === 0) {return;}

                    const length = list.length;
                    classDeclaration += ` ${keyword} `;
                    for (let x = 0; x < length; x++) {
                        const isLast = x === length - 1;
                        const type = list[x];
                        classDeclaration += type;

                        if (!isLast) {
                            classDeclaration += ', ';
                        }
                    }
                }

                addSuperTypes(this.mixins, 'with');
                addSuperTypes(this.interfaces, 'implements');

                classDeclaration += ' {\n';
                replacement = classDeclaration + replacement;
            } else if (l === this.propsEndAtLine && this.constr !== null && !this.hasConstructor) {
                replacement = this.constr + replacement;
                replacement = line + replacement;
            } else if (l === this.endsAtLine && this.isValid) {
                replacement = line + replacement;
                replacement = this.toInsert + replacement;
            } else {
                let rp = this.replacementAtLine(l);
                if (rp !== null) {
                    if (!replacement.includes(rp))
                        {replacement = rp + '\n' + replacement;}
                } else {
                    replacement = line + replacement;
                }
            }
        }
        return removeEnd(replacement, '\n');
    }
}

export class Imports {

    values:string[];
    startAtLine:number|null;
    endAtLine:number|null;
    text:string;
    rawImports:string|null;
    //
    constructor(text:string) {
        this.values = [];
        this.startAtLine = null;
        this.endAtLine = null;
        this.rawImports = null;
        this.text = text;

        this.readImports();
    }

    get hasImports():boolean {
        return this.values !== null && this.values.length > 0;
    }

    get hasExportDeclaration():boolean {
        return /^export /m.test(this.formatted);
    }

    get hasImportDeclaration():boolean {
        return /^import /m.test(this.formatted);
    }

    get hasPreviousImports():boolean {
        return this.startAtLine !== null && this.endAtLine !== null;
    }

    get didChange():boolean {
        return !areStrictEqual(this.rawImports!, this.formatted);
    }

    get range():vscode.Range {
        return new vscode.Range(
            new vscode.Position(this.startAtLine! - 1, 0),
            new vscode.Position(this.endAtLine!, 1),
        );
    }

    readImports() {
        this.rawImports = '';
        const lines = this.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const isLast = i === lines.length - 1;

            if (line.startsWith('import') || line.startsWith('export') || line.startsWith('part')) {
                this.values.push(line);
                this.rawImports += `${line}\n`;
                if (this.startAtLine === null) {
                    this.startAtLine = i + 1;
                }
                if (isLast) {
                    this.endAtLine = i + 1;
                    break;
                }
            } else {
                const isLicenseComment = line.startsWith('//') && this.values.length === 0;
                const didEnd = !(isBlank(line) || line.startsWith('library') || isLicenseComment);

                if (isLast || didEnd) {
                    if (this.startAtLine !== null) {
                        if (i > 0 && isBlank(lines[i - 1])) {
                            this.endAtLine = i - 1;
                        } else {
                            this.endAtLine = i;
                        }
                    }
                    break;
                }
            }
        }
    }

    get formatted():string {
        if (!this.hasImports) {return '';}

        let workspace = projectName;
        if (workspace === null || workspace.length === 0) {
            const file = getEditor()!.document.uri;
            if (file.scheme === 'file') {
                const folder = vscode.workspace.getWorkspaceFolder(file);
                if (folder) {
                    workspace = path.basename(folder.uri.fsPath).replace('-', '_');
                }
            }
        }

        const dartImports = [];
        const packageImports = [];
        const packageLocalImports = [];
        const relativeImports = [];
        const partStatements = [];
        const exports = [];

        for (let imp of this.values) {
            if (imp.startsWith('export')) {
                exports.push(imp);
            } else if (imp.startsWith('part')) {
                partStatements.push(imp);
            } else if (imp.includes('dart:')) {
                dartImports.push(imp);
            } else if (workspace !== null && imp.includes(`package:${workspace}`)) {
                packageLocalImports.push(imp);
            } else if (imp.includes('package:')) {
                packageImports.push(imp);
            } else {
                relativeImports.push(imp);
            }
        }

        let imps = '';
        function addImports(imports:any) {
            imports.sort();
            for (let i = 0; i < imports.length; i++) {
                const isLast = i === imports.length - 1;
                const imp = imports[i];
                imps += imp + '\n';

                if (isLast) {
                    imps += '\n';
                }
            }
        }

        addImports(dartImports);
        addImports(packageImports);
        addImports(packageLocalImports);
        addImports(relativeImports);
        addImports(exports);
        addImports(partStatements);

        return removeEnd(imps, '\n');
    }

    includes(imp: string) {
        return this.values.includes(imp);
    }

    push(imp:string) {
        return this.values.push(imp);
    }
    hastAtLeastOneImport(imps: string[]) {
        for (let imp of imps) {
            const impt = `import '${imp}';`;
            if (this.text.includes(impt) || this.includes(impt))
                {return true;}
        }
        return false;
    }

    requiresImport(imp:string, validOverrides:string[] = []) {
        const formattedImport = !imp.startsWith('import') ? "import '" + imp + "';" : imp;

        if (!this.includes(formattedImport) && !this.hastAtLeastOneImport(validOverrides)) {
            this.values.push(formattedImport);
        }
    }
}

export class ClassField {

    constructor(type='', name='', line = 1, isFinal = true, isConst = false) {
        this.rawType = type;
        this.jsonName = name;
        this.name = toVarName(name);
        this.line = line;
        this.isFinal = isFinal;
        this.isConst = isConst;
        this.isEnum = false;
        this.isCollectionType = (type:string) => this.rawType === type || this.rawType.startsWith(type + '<');
    }
    //
    rawType:string;
    jsonName:string;
    name:string;
    line:number;
    isFinal:boolean;
    isConst:boolean;
    isEnum:boolean;
    isCollectionType:any;
    //
    get type():string {
        return this.isNullable ? removeEnd(this.rawType, '?') : this.rawType;
    }

    get isNullable():boolean {
        return this.rawType.endsWith('?');
    }

    get isList():boolean {
        return this.isCollectionType('List');
    }

    get isMap():boolean {
        return this.isCollectionType('Map');
    }

    get isSet():boolean {
        return this.isCollectionType('Set');
    }

    get isCollection():boolean {
        return this.isList || this.isMap || this.isSet;
    }

    get listType():any {
        if (this.isList || this.isSet) {
            const collection = this.isSet ? 'Set' : 'List';
            const type = this.rawType === collection ? 'dynamic' : this.rawType.replace(collection + '<', '').replace('>', '');
            return new ClassField(type, this.name, this.line, this.isFinal);
        }
        return this;
    }

    get isPrimitive():boolean {
        let t = this.listType.type;
        return t === 'String' || t === 'num' || t === 'dynamic' || t === 'bool' || this.isDouble || this.isInt || this.isMap;
    }

    get isPrivate():boolean {
        return this.name.startsWith('_');
    }

    get defValue():string {
        if (this.isList) {
            return 'const []';
        } else if (this.isMap || this.isSet) {
            return 'const {}';
        } else {
            switch (this.type) {
                case 'String': return "''";
                case 'num':
                case 'int': return "0";
                case 'double': return "0.0";
                case 'bool': return 'false';
                case 'dynamic': return "null";
                default: return `${this.type}()`;
            }
        }
    }

    get isInt():boolean {
        return this.listType.type === 'int';
    }

    get isDouble():boolean {
        return this.listType.type === 'double';
    }
}

export class ClassPart {

    name:string;
    startsAt:number | null;
    endsAt:number | null;
    current:string | null;
    replacement:string | null;
     //
    constructor(name='', startsAt:number|null = null, endsAt:number|null = null, current:string|null = null, replacement:string|null = null) {
        this.name = name;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.current = current;
        this.replacement = replacement;
    }

    get isValid():boolean {
        return this.startsAt !== null && this.endsAt !== null && this.current !== null;
    }

    get startPos() {
        return new vscode.Position(this.startsAt!, 0);
    }

    get endPos() {
        return new vscode.Position(this.endsAt!, 0);
    }
}

export class DataClassGenerator {
   
    constructor(text='', clazzes:DartClass[]|null = null, fromJSON = false, part='') {
        this.text = text;
        this.fromJSON = fromJSON;
        this.clazzes = clazzes === null ? this.parseAndReadClasses() : clazzes;
        this.imports = new Imports(text);
        this.part = part;
        this.generateDataClazzes();
        this.clazz = null;
    }
    imports:Imports;
    clazzes: DartClass[] | null;
    fromJSON: boolean;
    part: string|undefined;
    text:string;
    clazz:any|null;
   
    get hasImports():boolean {
        return this.imports.hasImports;
    }

    requiresImport(imp:string, validOverrides:string[] = []) {
        this.imports.requiresImport(imp, validOverrides);
    }

    isPartSelected(part:string) {
        return this.part === null || this.part === part;
    }

    generateDataClazzes() {
        const insertConstructor = readSetting('constructor.enabled') && this.isPartSelected('constructor');

        for (let clazz of this.clazzes!) {
            this.clazz = clazz;

            if (insertConstructor)
                {this.insertConstructor(clazz);}

            if (!clazz.isWidget) {
                if (!clazz.isAbstract) {
                    if (readSetting('copyWith.enabled') && this.isPartSelected('copyWith'))
                        {this.insertCopyWith(clazz);}
                    if (readSetting('toMap.enabled') && this.isPartSelected('serialization'))
                        {this.insertToMap(clazz);}
                    if (readSetting('fromMap.enabled') && this.isPartSelected('serialization'))
                        {this.insertFromMap(clazz);}
                    if (readSetting('toJson.enabled') && this.isPartSelected('serialization'))
                        {this.insertToJson(clazz);}
                    if (readSetting('fromJson.enabled') && this.isPartSelected('serialization'))
                        {this.insertFromJson(clazz);}
                }

                if (readSetting('toString.enabled') && this.isPartSelected('toString'))
                    {this.insertToString(clazz);}

                if ((clazz.usesEquatable || readSetting('useEquatable')) && this.isPartSelected('useEquatable')) {
                    this.insertEquatable(clazz);
                } else {
                    if (readSetting('equality.enabled') && this.isPartSelected('equality'))
                        {this.insertEquality(clazz);}
                    if (readSetting('hashCode.enabled') && this.isPartSelected('equality'))
                        {this.insertHash(clazz);}
                }
            }
        }
    }

   
    findPart(name:string, finder:string, clazz:DartClass) {
        const normalize = (src:any) => {
            let result = '';
            let generics = 0;
            let prevChar = '';
            for (const char of src) {
                if (char === '<') {generics++;}
                if (char !== ' ' && generics === 0) {
                    result += char;
                }

                if (prevChar !== '=' && char === '>') {generics--;}
                prevChar = char;
            }

            return result;
        };

        const finderString = normalize(finder);
        const lines = clazz.classContent.split('\n');
        const part = new ClassPart(name);
        let curlies = 0;
        let singleLine = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = clazz.startsAtLine! + i;

            curlies += count(line, '{');
            curlies -= count(line, '}');

            if (part.startsAt === null && normalize(line).startsWith(finderString)) {
                if (line.includes('=>')) {singleLine = true;}
                if (curlies === 2 || singleLine) {
                    part.startsAt = lineNum;
                    part.current = line + '\n';
                }
            } else if (part.startsAt !== null && part.endsAt === null && (curlies >= 2 || singleLine)) {
                part.current += line + '\n';
            } else if (part.startsAt !== null && part.endsAt === null && curlies === 1) {
                part.endsAt = lineNum;
                part.current += line;
            }

            // Detect the end of a single line function by searching for the ';' because
            // a single line function doesn't necessarily only have one single line.
            if (singleLine && part.startsAt !== null && part.endsAt === null && line.trimEnd().endsWith(';')) {
                part.endsAt = lineNum;
            }
        }

        return part.isValid ? part : null;
    }

    /**
     * If class already exists and has a constructor with the parameter, reuse that parameter.
     * E.g. when the dev changed the parameter from this.x to this.x = y the generator inserts
     * this.x = y. This way the generator can preserve changes made in the constructor.
     */
    findConstrParameter(prop:ClassField | string, oldProps:any) {
        const name = typeof prop === 'string' ? prop : prop.name;
        for (let oldProp of oldProps) {
            if (name === oldProp.name) {
                return oldProp;
            }
        }
        return null;
    }

    findOldConstrProperties(clazz:DartClass) {
        if (!clazz.hasConstructor || clazz.constrStartsAtLine === clazz.constrEndsAtLine) {
            return [];
        }

        let oldConstr = '';
        let brackets = 0;
        let didFindConstr = false;
        for (let c of clazz.constr!) {
            if (c === '(') {
                if (didFindConstr) {oldConstr += c;}
                brackets++;
                didFindConstr = true;
                continue;
            } else if (c === ')') {
                brackets--;
                if (didFindConstr && brackets === 0)
                    {break;}
            }

            if (brackets >= 1)
                {oldConstr += c;}
        }

        oldConstr = removeStart(oldConstr, ['{', '[']);
        oldConstr = removeEnd(oldConstr, ['}', ']']);

        let oldArguments = oldConstr.split('\n');
        const oldProperties = [];
        for (let arg of oldArguments) {
            let formatted = arg.replace('required', '').trim();
            if (formatted.indexOf('=') !== -1) {
                formatted = formatted.substring(0, formatted.indexOf('=')).trim();
            }

            let name = null;
            let isThis = false;
            if (formatted.startsWith('this.')) {
                name = formatted.replace('this.', '');
                isThis = true;
            } else {
                const words = formatted.split(' ');
                if (words.length >= 1) {
                    const w = words[1];
                    if (!isBlank(w)) {name = w;}
                }
            }

            if (name !== null) {
                oldProperties.push({
                    "name": removeEnd(name.trim(), ','),
                    "text": arg.trim() + '\n',
                    "isThis": isThis,
                });
            }
        }

        return oldProperties;
    }
    insertConstructor(clazz: DartClass) {
        const withDefaults = readSetting('constructor.default_values');

        let constr = '';
        let startBracket = '({';
        let endBracket = '})';

        if (clazz.constr !== null) {
            if (clazz.constr.trimStart().startsWith('const'))
                {constr += 'const ';}

            // Detect custom constructor brackets and preserve them.
            const fConstr = clazz.constr.replace('const', '').trimStart();

            if (fConstr.startsWith(clazz.name + '([')) {startBracket = '([';}
            else if (fConstr.startsWith(clazz.name + '({')) {startBracket = '({';}
            else {startBracket = '(';}

            if (fConstr.includes('])')) {endBracket = '])';}
            else if (fConstr.includes('})')) {endBracket = '})';}
            else {endBracket = ')';}
        } else {
            if (clazz.isWidget || ((clazz.usesEquatable || readSetting('useEquatable')) && this.isPartSelected('useEquatable')))
                {constr += 'const ';}
        }

        constr += clazz.name + startBracket + '\n';

        // Add 'Key key,' for widgets in constructor.
        if (clazz.isWidget) {
            let hasKey = false;
            let clazzConstr = clazz.constr || '';
            for (let line of clazzConstr.split('\n')) {
                if (line.trim().startsWith('Key? key')) {
                    hasKey = true;
                    break;
                }
            }

            if (!hasKey)
                {constr += '  Key? key,\n';}
        }

        const oldProperties = this.findOldConstrProperties(clazz);
        for (let prop of oldProperties) {
            if (!prop.isThis) {
                constr += '  ' + prop.text;
            }
        }

        for (let prop of clazz.properties) {
            const oldProperty = this.findConstrParameter(prop, oldProperties);
            if (oldProperty !== null) {
                if (oldProperty.isThis)
                    {constr += '  ' + oldProperty.text;}

                continue;
            }

            const parameter = `this.${prop.name}`;

            constr += '  ';

            if (!prop.isNullable) {
                const hasDefault = withDefaults && ((prop.isPrimitive || prop.isCollection) && prop.rawType !== 'dynamic');
                const isNamedConstr = startBracket === '({' && endBracket === '})';

                if (hasDefault) {
                    constr += `${parameter} = ${prop.defValue},\n`;
                } else if (isNamedConstr) {
                    constr += `required ${parameter},\n`;
                } else {
                    constr += `${parameter},\n`;
                }
            } else {
                constr += `${parameter},\n`;
            }
        }

        const stdConstrEnd = () => {
            constr += endBracket + (clazz.isWidget ? ' : super(key: key);' : ';');
        };

        if (clazz.constr !== null) {
            let i = null;
            if (clazz.constr.includes(' : ')) {i = clazz.constr.indexOf(' : ') + 1;}
            else if (clazz.constr.trimEnd().endsWith('{')) {i = clazz.constr.lastIndexOf('{');}

            if (i !== null) {
                let ending = clazz.constr.substring(i, clazz.constr.length);
                constr += `${endBracket} ${ending}`;
            } else {
                stdConstrEnd();
            }
        } else {
            stdConstrEnd();
        }

        if (clazz.hasConstructor) {
            clazz.constrDifferent = !areStrictEqual(clazz.constr!, constr);
            if (clazz.constrDifferent) {
                constr = removeEnd(indent(constr), '\n');
                this.replace(new ClassPart('constructor', clazz.constrStartsAtLine!, clazz.constrEndsAtLine, clazz.constr, constr), clazz);
            }
        } else {
            clazz.constrDifferent = true;
            this.append(constr, clazz, true);
        }
    }


    insertCopyWith(clazz: DartClass) {
        let method = clazz.type + ' copyWith({\n';
        for (const prop of clazz.properties) {
            method += `  ${prop.type}? ${prop.name},\n`;
        }
        method += '}) {\n';
        method += `  return ${clazz.type}(\n`;

        for (let p of clazz.properties) {
            method += `    ${clazz.hasNamedConstructor ? `${p.name}: ` : ''}${p.name} ?? this.${p.name},\n`;
        }

        method += '  );\n';
        method += '}';

        this.appendOrReplace('copyWith', method, `${clazz.name} copyWith(`, clazz);
    }

    insertToMap(clazz:DartClass) {
        let props = clazz.properties;

        function customTypeMapping(prop:ClassField, name:string|null = null, endFlag = ',\n') {
            prop = prop.isCollection ? prop.listType : prop;
            name = name === null ? prop.name : name;

            const nullSafe = prop.isNullable ? '?' : '';

            switch (prop.type) {
                case 'DateTime':
                    return `${name}${nullSafe}.millisecondsSinceEpoch${endFlag}`;
                case 'Color':
                    return `${name}${nullSafe}.value${endFlag}`;
                case 'IconData':
                    return `${name}${nullSafe}.codePoint${endFlag}`;
                default:
                    return `${name}${!prop.isPrimitive ? `${nullSafe}.toMap()` : ''}${endFlag}`;
            }
        }

        let method = `Map<String, dynamic> toMap() {\n`;
        method += '  return <String, dynamic>{\n';
        for (let p of props) {
            method += `    '${p.jsonName}': `;

            if (p.isEnum) {
                if (p.isCollection) {method += `${p.name}.map((x) => x.index).toList(),\n`;}
                else {method += `${p.name}.index,\n`;}
            } else if (p.isCollection) {
                if (p.isMap || p.listType.isPrimitive) {
                    const mapFlag = p.isSet ? (p.isNullable ? '?' : '') + '.toList()' : '';
                    method += `${p.name}${mapFlag},\n`;
                } else {
                    method += `${p.name}.map((x) => ${customTypeMapping(p, 'x', '')}).toList(),\n`;
                }
            } else {
                method += customTypeMapping(p);
            }
            if (p.name === props[props.length - 1].name) {method += '  };\n';}
        }
        method += '}';

        this.appendOrReplace('toMap', method, 'Map<String, dynamic> toMap()', clazz);
    }

    insertFromMap(clazz:DartClass) {
        let withDefaultValues = readSetting('fromMap.default_values');
        const leftOfValue = withDefaultValues ? '(': '' ;
        const rightOfValue = withDefaultValues ? ')': '' ;
        let props = clazz.properties;
        const fromJSON = this.fromJSON;

        function customTypeMapping(prop:ClassField, value:string|null = null) {
            const materialConvertValue = prop.isCollection ? "" :" as int";
            prop = prop.isCollection ? prop.listType : prop;
            const isAddDefault = withDefaultValues && prop.rawType !== 'dynamic'&& !prop.isNullable &&  prop.isPrimitive;
            const addLeftDefault = isAddDefault  ? leftOfValue : '';
            const addRightDefault = isAddDefault ? rightOfValue : '';
          value = value === null ? `${addLeftDefault}map['` + prop.jsonName + "']" : value;

            switch (prop.type) {
                case 'DateTime':
                    value=withDefaultValues ? `${leftOfValue}${value}??0${rightOfValue}` : value;
                    return `DateTime.fromMillisecondsSinceEpoch(${value}${materialConvertValue})`;
                case 'Color':
                    value=withDefaultValues ? `${leftOfValue}${value}??0${rightOfValue}` : value;
                    return `Color(${value}${materialConvertValue})`;
                case 'IconData':
                    value=withDefaultValues ? `${leftOfValue}${value}??0${rightOfValue}` : value;
                    return `IconData(${value}${materialConvertValue}, fontFamily: 'MaterialIcons')`;
                default:
                    return `${
                      !prop.isPrimitive ? prop.type + ".fromMap(" : ""
                    }${value}${!prop.isPrimitive ? " as Map<String,dynamic>)" : ""}${
                      fromJSON
                        ? prop.isDouble
                          ? ".toDouble()"
                          : prop.isInt
                          ? ".toInt()"
                          : ""
                        : ""
                    }${
                        isAddDefault
                        ? ` ?? ${prop.defValue}${addRightDefault}`
                        : ""
                    }`;
            }
        }

        let method = `factory ${clazz.name}.fromMap(Map<String, dynamic> map) {\n`;
        method += '  return ' + clazz.type + '(\n';

        for (let p of props) {
            method += `    ${clazz.hasNamedConstructor ? `${p.name}: ` : ''}`;

            const value = `map['${p.jsonName}']`;

            // Add nullable check before serialization
            if (p.isNullable) {
                method += value + ' != null ? ';
            }

            // serialization
            if (p.isEnum) {
                // List<E>
                if (p.isCollection) {
                    const defaultValue = withDefaultValues ? ' ?? <int>[]' : '';
                    method += `${p.type}.from((${leftOfValue}${value}${defaultValue}${rightOfValue} as List<int>).map<${p.listType.rawType}>((x) => ${p.listType.rawType}.values[x]),)`;
                } else {
                    const defaultValue = withDefaultValues ? ' ?? 0' : '';
                    method += `${p.rawType}.values[${leftOfValue}${value}${defaultValue}${rightOfValue} as int]`;
                }

            } else if (p.isCollection) {
                const defaultValue =
                  withDefaultValues && !p.isNullable && p.isPrimitive
                    ? ` ?? const <${p.listType.rawType}>${
                        p.isList ? "[]" : "{}"
                      })`
                    : "";

                method += `${p.type}.from(`;
                /// List<String>.from(map['allowed'] ?? const <String>[] as List<String>), 
                if (p.isPrimitive) {
                    method += `(${value}${defaultValue} as ${p.type})`;
                } else {
                    method += `(${value} as List<int>).map<${p.listType.rawType}>((x) => ${customTypeMapping(p, 'x')},),${defaultValue})`;
                }
            /// (map['name'] ?? '') as String
            } else {
                if (p.isPrimitive) 
                    {method += customTypeMapping(p)+` as ${p.type}`;}
                else
                    {method += customTypeMapping(p);}
            }
            // end nullable check if field is nullable
            if (p.isNullable) {
                method += " : null";
            }

            method += `,\n`;

            const isLast = p.name === props[props.length - 1].name;
            if (isLast) {method += '  );\n';}
        }
        method += '}';

        this.appendOrReplace('fromMap', method, `factory ${clazz.name}.fromMap(Map<String, dynamic> map)`, clazz);
    }

    insertToJson(clazz:DartClass) {
        this.requiresImport('dart:convert');

        const method = 'String toJson() => json.encode(toMap());';
        this.appendOrReplace('toJson', method, 'String toJson()', clazz);
    }

    insertFromJson(clazz:DartClass) {
        this.requiresImport('dart:convert');

        const method = `factory ${clazz.name}.fromJson(String source) => ${clazz.name}.fromMap(json.decode(source) as Map<String, dynamic>);`;
        this.appendOrReplace('fromJson', method, `factory ${clazz.name}.fromJson(String source)`, clazz);
    }

    insertToString(clazz:DartClass) {
        if (clazz.usesEquatable || readSetting('useEquatable')) {
            let stringify = '@override\n';
            stringify += 'bool get stringify => true;';

            this.appendOrReplace('stringify', stringify, 'bool get stringify', clazz);
        } else {
            const short = clazz.fewProps;
            const props = clazz.properties;
            let method = '@override\n';
            method += `String toString() ${!short ? '{\n' : '=>'}`;
            method += `${!short ? '  return' : ''} '` + `${clazz.name}(`;
            for (let p of props) {
                const name = p.name;
                const isFirst = name === props[0].name;
                const isLast = name === props[props.length - 1].name;

                if (!isFirst)
                    {method += ' ';}

                method += name + ': $' + name + ',';

                if (isLast) {
                    method = removeEnd(method, ',');
                    method += ")';" + (short ? '' : '\n');
                }
            }
            method += !short ? '}' : '';

            this.appendOrReplace('toString', method, 'String toString()', clazz);
        }
    }

    insertEquality(clazz:DartClass) {
        const props = clazz.properties;
        const hasCollection = props.find((p) => p.isCollection) !== undefined;

        let collectionEqualityFn;
        if (hasCollection) {
            // Flutter already has collection equality functions 
            // in the foundation package.
            if (isFlutter) {
                this.requiresImport('package:flutter/foundation.dart');
            } else {
                this.requiresImport('package:collection/collection.dart');

                collectionEqualityFn = 'collectionEquals';
                const isListOnly = props.find((p) => p.isCollection && !p.isList) === undefined;
                if (isListOnly) {collectionEqualityFn = 'listEquals';}
                const isMapOnly = props.find((p) => p.isCollection && !p.isMap) === undefined;
                if (isMapOnly) {collectionEqualityFn = 'mapEquals';}
                const isSetOnly = props.find((p) => p.isCollection && !p.isSet) === undefined;
                if (isSetOnly) {collectionEqualityFn = 'setEquals';}
            }
        }

        let method = '@override\n';
        method += `bool operator ==(covariant ${clazz.type} other) {\n`;
        method += '  if (identical(this, other)) return true;\n';
        if (hasCollection && !isFlutter)
            {method += `  final ${collectionEqualityFn} = const DeepCollectionEquality().equals;\n`;};
        method += '\n';
        method += '  return \n';
        for (let prop of props) {
            if (prop.isCollection) {
                if (isFlutter) {collectionEqualityFn = prop.isSet ? 'setEquals' : prop.isMap ? 'mapEquals' : 'listEquals';}
                method += `    ${collectionEqualityFn}(other.${prop.name}, ${prop.name})`;
            } else {
                method += `    other.${prop.name} == ${prop.name}`;
            }
            if (prop.name !== props[props.length - 1].name) {method += ' &&\n';}
            else {method += ';\n';}
        }
        method += '}';

        this.appendOrReplace('equality', method, 'bool operator ==', clazz);
    }

    insertHash(clazz:DartClass) {
        const useJenkins = readSetting('hashCode.use_jenkins');
        const short = !useJenkins && clazz.fewProps;
        const props = clazz.properties;
        let method = '@override\n';
        method += `int get hashCode ${short ? '=>' : '{\n  return '}`;

        if (useJenkins) {
            // dart:ui import is required for Jenkins hash.
            this.requiresImport('dart:ui', [
                'package:flutter/material.dart',
                'package:flutter/cupertino.dart',
                'package:flutter/widgets.dart'
            ]);

            method += `hashList([\n`;
            for (let p of props) {
                method += '    ' + p.name + `,\n`;
            }
            method += '  ]);';
        } else {
            for (let p of props) {
                const isFirst = p === props[0];
                method += `${isFirst && !short ? '' : short ? ' ' : '    '}${p.name}.hashCode`;
                if (p === props[props.length - 1]) {
                    method += ';';
                } else {
                    method += ` ^${!short ? '\n' : ''}`;
                }
            }
        }

        if (!short) {method += '\n}';}

        this.appendOrReplace('hashCode', method, 'int get hashCode', clazz);
    }

    addEquatableDetails(clazz:DartClass) {
        // Do not generate Equatable for class with 'Base' in their
        // names as Base classes should inherit from Equatable.
        // see: https://github.com/BendixMa/Dart-Data-Class-Generator/issues/8
        if (clazz.hasSuperclass && clazz.superclass!.includes('Base')) {return;}

        this.requiresImport('package:equatable/equatable.dart');

        if (!clazz.usesEquatable) {
            if (clazz.hasSuperclass||readSetting('useEquatableMixin')) {
                this.addMixin('EquatableMixin');
            } else {
                this.setSuperClass('Equatable');
            }
        }
    }

    insertEquatable(clazz:DartClass) {
        this.addEquatableDetails(clazz);

        const props = clazz.properties;
        const short = props.length <= 4;
        const split = short ? ', ' : ',\n';
        let method = '@override\n';
        method += `List<Object> get props ${!short ? '{\n' : '=>'}`;
        method += `${!short ? '  return' : ''} ` + '[' + (!short ? '\n' : '');
        for (let prop of props) {
            const isLast = prop.name === props[props.length - 1].name;
            const inset = !short ? '    ' : '';
            method += inset + prop.name + split;

            if (isLast) {
                if (short) {method = removeEnd(method, split);}
                method += (!short ? '  ' : '') + '];' + (!short ? '\n' : '');
            }
        }
        method += !short ? '}' : '';

        this.appendOrReplace('props', method, 'List<Object> get props', clazz);
    }

    addMixin(mixin:string) {
        const mixins = this.clazz.mixins;
        if (!mixins.includes(mixin)) {
            mixins.push(mixin);
        }
    }

    addInterface(impl:string) {
        const interfaces = this.clazz.interfaces;
        if (!interfaces.includes(impl)) {
            interfaces.push(impl);
        }
    }

    setSuperClass(clazz:string) {
        this.clazz.superclass = clazz;
    }

    appendOrReplace(name:string, n:string, finder:string, clazz:DartClass) {
        let part = this.findPart(name, finder, clazz);
        let replacement = removeEnd(indent(n.replace('@override\n', '')), '\n');

        if (part !== null) {
            part.replacement = replacement;
            if (!areStrictEqual(part.current!, part.replacement)) {
                this.replace(part, clazz);
            }
        } else {
            this.append(n, clazz);
        }
    }

    append(method:string, clazz:DartClass, constr = false) {
        let met = indent(method);
        constr ? clazz.constr = met : clazz.toInsert += '\n' + met;
    }

    replace(part:ClassPart, clazz:DartClass) {
        clazz.toReplace.push(part);
    }

    parseAndReadClasses():DartClass[] {
        let clazzes = [];
        let clazz = new DartClass();

        let lines = this.text.split('\n');
        let curlyBrackets = 0;
        let brackets = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const linePos = i + 1;
            // Make sure to look for 'class ' with the space in order to allow
            // fields that contain the word 'class' as in classifire.
            // issue: https://github.com/BendixMa/Dart-Data-Class-Generator/issues/2
            const classLine = line.trimStart().startsWith('class ') || line.trimStart().startsWith('abstract class ');

            if (classLine) {
                clazz = new DartClass();
                clazz.startsAtLine = linePos;

                let classNext = false;
                let extendsNext = false;
                let implementsNext = false;
                let mixinsNext = false;

                // Reset brackets count when a new class was detected.
                curlyBrackets = 0;
                brackets = 0;

                const words = this.splitWhileMaintaingGenerics(line);
                for (let word of words) {
                    word = word.trim();
                    if (word.length > 0) {
                        if (word === 'class') {
                            classNext = true;
                        } else if (word === 'extends') {
                            extendsNext = true;
                        } else if (extendsNext) {
                            extendsNext = false;
                            clazz.superclass = word;
                        } else if (word === 'with') {
                            mixinsNext = true;
                            extendsNext = false;
                            implementsNext = false;
                        } else if (word === 'implements') {
                            mixinsNext = false;
                            extendsNext = false;
                            implementsNext = true;
                        } else if (classNext) {
                            classNext = false;
                            // Remove generics from class name.
                            if (word.includes('<')) {
                                clazz.fullGenericType = word.substring(
                                    word.indexOf('<'),
                                    word.lastIndexOf('>') + 1,
                                );
                                word = word.substring(0, word.indexOf('<'));
                            }
                            clazz.name = word;
                        } else if (mixinsNext) {
                            const mixin = removeEnd(word, ',').trim();

                            if (mixin.length > 0) {
                                clazz.mixins.push(mixin);
                            }
                        } else if (implementsNext) {
                            const impl = removeEnd(word, ',').trim();
                            if (impl.length > 0) {
                                clazz.interfaces.push(impl);
                            }
                        }
                    }
                }
                // Do not add State<T> classes of widgets.
                if (!clazz.isState) {
                    clazzes.push(clazz);
                }
            }

            if (clazz.classDetected) {
                // Check if class ended based on bracket count. If all '{' have a '}' pair,
                // class can be closed.
                curlyBrackets += count(line, '{');
                curlyBrackets -= count(line, '}');
                // Count brackets, e.g. to find the constructor.
                brackets += count(line, '(');
                brackets -= count(line, ')');
                // Detect beginning of constructor by looking for the class name and a bracket, while also
                // making sure not to falsely detect a function constructor invocation with the actual 
                // constructor with boilerplaty checking all possible constructor options.
                const includesConstr = line.replace('const', '').trimStart().startsWith(clazz.name + '(');
                if (includesConstr && !classLine) {
                    clazz.constrStartsAtLine = linePos;
                }
                if (clazz.constrStartsAtLine !== null && clazz.constrEndsAtLine === null) {
                    clazz.constr = clazz.constr === null ? line + '\n' : clazz.constr + line + '\n';

                    // Detect end of constructor.
                    if (brackets === 0) {
                        clazz.constrEndsAtLine = linePos;
                        clazz.constr = removeEnd(clazz.constr, '\n');
                    }
                }
                clazz.classContent += line;
                // Detect end of class.
                if (curlyBrackets !== 0) {
                    clazz.classContent += '\n';
                } else {
                    clazz.endsAtLine = linePos;
                    clazz = new DartClass();
                }

                if (brackets === 0 && curlyBrackets === 1) {
                    // Check if a line is valid to only include real properties.
                    const lineValid =
                        // Line shouldn't start with the class name as this would
                        // be the constructor or an error.
                        !line.trimStart().startsWith(clazz.name!) &&
                        // Ignore comments.
                        !line.trimStart().startsWith('//') &&
                        // These symbols would indicate that this is not a field.
                        !includesOne(line, ['{', '}', '=>', '@'], false) &&
                        // Filter out some keywords.
                        !includesOne(line, ['static', 'set', 'get', 'return', 'factory']) &&
                        // Do not include final values that are assigned a value.
                        !includesAll(line, ['final ', '=']) &&
                        // Do not inlcude non final fields that were declared after the constructor.
                        (clazz.constrStartsAtLine === null || line.includes('final ')) &&
                        // Make sure not to catch abstract functions.
                        !line.replace(/\s/g, '').endsWith(');');

                    if (lineValid) {
                        let type = null;
                        let name = null;
                        let isFinal = false;
                        let isConst = false;

                        const words = line.trim().split(' ');
                        for (let i = 0; i < words.length; i++) {
                            const word = words[i];
                            const isLast = i === words.length - 1;

                            if (word.length > 0 && word !== '}' && word !== '{') {
                                if (word === 'final') {
                                    isFinal = true;
                                } else if (i === 0 && word === 'const') {
                                    isConst = true;
                                }

                                // Be sure to not include keywords.
                                if (word !== 'final' && word !== 'const') {
                                    // If word ends with semicolon => variable name, else type.
                                    let isVariable = word.endsWith(';') || (!isLast && (words[i + 1] === '='));
                                    // Make sure we don't capture abstract functions like: String func();
                                    isVariable = isVariable && !includesOne(word, ['(', ')']);
                                    if (isVariable) {
                                        if (name === null)
                                            {name = removeEnd(word, ';');}
                                    } else {
                                        if (type === null) {type = word;}
                                        // Types can have gaps => Pair<A, B>,
                                        // thus append word to type if a name hasn't
                                        // been detected.
                                        else if (name === null) {type += ' ' + word;}
                                    }
                                }
                            }
                        }

                        if (type !== null && name !== null) {
                            const prop = new ClassField(type, name, linePos, isFinal, isConst);

                            if (i > 0) {
                                const prevLine = lines[i - 1];
                                prop.isEnum = prevLine.match(/.*\/\/(\s*)enum/) !== null;
                            }

                            clazz.properties.push(prop);
                        }
                    }
                }
            }
        }
        return clazzes;
    }
    /**
     * This function is for parsing the class name line while maintaining
     * also more complex generic types like class A<A, List<C>>.
     */
    splitWhileMaintaingGenerics(line: string) {
        let words: any[] = [];
        let index = 0;
        let generics = 0;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const isCurly = char === '{';
            const isSpace = char === ' ';

            if (char === '<') {generics++;}
            if (char === '>') {generics--;}

            if (generics === 0 && (isSpace || isCurly)) {
                const word = line.substring(index, i).trim();

                // Do not add whitespace.
                if (word.length === 0) {continue;}
                const isOnlyGeneric = word.startsWith('<');

                // Append the generic type to the word when there is spacing
                // between them. E.g.: class Hello <A, B>
                if (isOnlyGeneric) {
                    words[words.length - 1] = words[words.length - 1] + word;
                } else {
                    words.push(word);
                }

                if (isCurly) {
                    break;
                }
                index = i;
            }
        }
        return words;
    }
}

export class DartFile {
    
    constructor(clazz:DartClass, content:string) {
        this.clazz = clazz;
        this.name = createFileName(clazz.name!);
        this.content = content || clazz.classContent;
    }
    clazz: DartClass;
    name: string;
    content: string;
}

export class JsonReader {
    
    clazzes: DartClass[];
    files: DartFile[];
    json: string;
    clazzName: string;
    error: Promise<any>;
    //
    constructor(source: string|undefined, className: string) {
        this.json = this.toPlainJson(source!);
        this.clazzName = capitalize(className);
        this.clazzes = [];
        this.files = [];
        this.error = this.checkJson();
    }

    async checkJson() {
        const isArray = this.json.startsWith('[');
        if (isArray && !this.json.includes('{')) {
            return 'Primitive JSON arrays are not supported! Please serialize them directly.';
        }
        if (await this.generateFiles()) {
            return 'The provided JSON is malformed or couldn\'t be parsed!';
        }
        return null;
    }


    toPlainJson(source: string) {
        return source.replace(new RegExp(' ', 'g'), '').replace(new RegExp('\n', 'g'), '');
    }

    getPrimitive(value: string) {
        let type = typeof (value);
        let sType = null;

        if (type === 'number') {
            sType = Number.isInteger(value) ? 'int' : 'double';
        } else if (type === 'string') {
            sType = 'String';
        } else if (type === 'boolean') {
            sType = 'bool';
        }

        return sType;
    }

    /**
     * Create DartClasses from a JSON mapping with class content and properties.
     * This is intended only for creating new files not overriding exisiting ones.
     */
    getClazzes(object:any, key: string) {
        let clazz = new DartClass();
        clazz.startsAtLine = 1;
        clazz.name = capitalize(key);

        let isArray = false;
        if (object instanceof Array) {
            isArray = true;
            clazz.isArray = true;
            clazz.name += 's';
        } else {
            // Top level arrays are currently not supported!
            this.clazzes.push(clazz);
        }

        let i = 1;
        clazz.classContent += 'class ' + clazz.name + ' {\n';
        for (let key in object) {
            // named key for class names.
            let k = !isArray ? key : removeEnd(clazz.name.toLowerCase(), 's');

            let value = object[key];
            let type = this.getPrimitive(value);

            if (type === null) {
                if (value instanceof Array) {
                    if (value.length > 0) {
                        let listType = k;
                        // Adjust the class name of lists. E.g. a key with items
                        // becomes a class name of Item.
                        if (k.endsWith('ies')) {listType = removeEnd(k, 'ies') + 'y';}
                        if (k.endsWith('s')) {listType = removeEnd(k, 's');}
                        const i0 = this.getPrimitive(value[0]);

                        if (i0 === null) {
                            this.getClazzes(value[0], listType);
                            type = 'List<' + capitalize(listType) + '>';
                        } else {
                            type = 'List<' + i0 + '>';
                        }
                    } else {
                        type = 'List<dynamic>';
                    }
                } else {
                    this.getClazzes(value, k);
                    type = !isArray ? capitalize(key) : `List<${capitalize(k)}>`;
                }
            }

            clazz.properties.push(new ClassField(type, k, ++i));
            clazz.classContent += `  final ${type} ${toVarName(k)};\n`;

            // If object is JSONArray, break after first item.
            if (isArray) {break;}
        }
        clazz.endsAtLine = ++i;
        clazz.classContent += '}';
    }


    getGeneratedTypeCount(property: string) {
        let p = new ClassField(property, 'x');
        let i = 0;
        if (!p.isPrimitive) {
            for (let clazz of this.clazzes) {
                if (clazz.name === p.rawType) {
                    i++;
                }
            }
        }
        return i;
    }

    async generateFiles() {
        try {
            const json = JSON.parse(this.json);
            this.getClazzes(json, this.clazzName);
            this.removeDuplicates();

            for (let clazz of this.clazzes) {
                this.files.push(new DartFile(clazz,''));
            }
            return false;
        } catch (e) {
            // console.log(e);
            return true;
        }
    }

    // If multiple clazzes of the same class exist, remove the duplicates
    // before writing them.
    removeDuplicates() {
        let result:any[] = [];
        let clazzes = this.clazzes.map((item) => item.classContent);
        clazzes.forEach((item, index) => {
            if (clazzes.indexOf(item) === index) {
                result.push(this.clazzes[index]);
            }
        });
        this.clazzes = result;
    }


    addGeneratedFilesAsImport(generator:DataClassGenerator) {
        const clazz = generator.clazzes![0];
        for (let prop of clazz.properties) {
            // Import only inambigous generated types.
            // E.g. if there are multiple generated classes with
            // the same name, do not include an import of that class.
            if (this.getGeneratedTypeCount(prop.listType.rawType) === 1) {
                const imp = `import '${createFileName(prop.listType.rawType)}.dart';`;
                generator.imports.push(imp);
            }
        }
    }

    async commitJson(progress:any, seperate: boolean) {
        let path = getCurrentPath();
        let fileContent = '';

        const length = this.files.length;
        for (let i = 0; i < length; i++) {
            const file = this.files[i];
            const isLast = i === length - 1;
            const generator = new DataClassGenerator(file.content, [file.clazz], true);

            if (seperate)
                {
                    this.addGeneratedFilesAsImport(generator);
                }

            const imports = `${generator.imports.formatted}\n`;

            progress.report({
                increment: ((1 / length) * 100),
                message: `Creating file ${file.name}...`
            });

            if (seperate) {
                const clazz = generator.clazzes![0];

                const replacement = imports + clazz.generateClassReplacement();
                if (i > 0) {
                    await writeFile(replacement, file.name, false, path);
                } else {
                    await getEditor()!.edit(editor => {
                        editorReplace(editor, 0, null, replacement);
                    });
                }

                // Slow the writing process intentionally down.
                await new Promise(resolve => setTimeout(() => resolve(null), 120));
            } else {
                // Insert in current file when JSON should not be seperated.
                for (let clazz of generator.clazzes!) {
                    fileContent += clazz.generateClassReplacement() + '\n\n';
                }

                if (isLast) {
                    fileContent = removeEnd(fileContent, '\n\n');
                    await getEditor()!.edit(editor => {
                        editorReplace(editor, 0, null, fileContent);
                        editorInsert(editor, 0, imports);
                    });
                }
            }
        }
    }
}

export class DataClassCodeActions {
    constructor() {
        this.clazz = new DartClass();
        this.generator = null;
        this.document = getDoc();
        this.line = '';
        this.range;
    }


    clazz: DartClass|undefined;
    generator :DataClassGenerator|null;
    document :vscode.TextDocument|undefined ;
    line:string;
    range:any;
   
    get uri() {
        return this.document!.uri;
    }

    get lineNumber() {
        return this.range.start.line + 1;
    }

    get charPos() {
        return this.range.start.character;
    }

 
     provideCodeActions(document:vscode.TextDocument, range:vscode.Range):vscode.CodeAction|any {
        if (!readSetting('quick_fixes')) {
            return;
        }

        this.range = range;
        this.document = document;
        this.line = document.lineAt(range.start).text;
        this.generator = new DataClassGenerator(document.getText());
        this.clazz = this.getClass();

        // * Class independent code actions.
        const codeActions = [
            this.createImportsFix(),
        ];

        if (this.clazz === null || !this.clazz!.isValid) {
            return codeActions;
        }

        const line = this.lineNumber;
        const clazz = this.clazz;
        const isAtClassDeclaration = line === clazz!.startsAtLine;
        const isInProperties = clazz!.properties.find((p) => p.line === line) !== undefined;
        const isInConstrRange = line >= clazz!.constrStartsAtLine! && line <= clazz!.constrEndsAtLine!;
        if (!(isAtClassDeclaration || isInProperties || isInConstrRange)) {return codeActions;}

        // * Class code actions.
        if (!this.clazz!.isWidget)
            {codeActions.push(this.createDataClassFix(this.clazz!));}

        if (readSetting('constructor.enabled'))
            {codeActions.push(this.createConstructorFix());}

        // Only add constructor fix for widget classes.
        if (!this.clazz!.isWidget) {
            // Copy with and JSON serialization should be handled by
            // subclasses.
            if (!this.clazz!.isAbstract) {
                if (readSetting('copyWith.enabled'))
                    {codeActions.push(this.createCopyWithFix());}
                if (readSettings(['toMap.enabled', 'fromMap.enabled', 'toJson.enabled', 'fromJson.enabled']))
                    {codeActions.push(this.createSerializationFix());}
            }

            if (readSetting('toString.enabled'))
                {codeActions.push(this.createToStringFix());}

            if (clazz!.usesEquatable || readSetting('useEquatable'))
                {codeActions.push(this.createUseEquatableFix());}
            else {
                if (readSettings(['equality.enabled', 'hashCode.enabled']))
                    {codeActions.push(this.createEqualityFix());}
            }
        }

        return codeActions;
    }


    createFix(description:string, editor:(arg0: vscode.WorkspaceEdit) => void) {
        const fix = new vscode.CodeAction(description, vscode.CodeActionKind.QuickFix);
        const edit = new vscode.WorkspaceEdit();
        editor(edit);
        fix.edit = edit;
        return fix;
    }


    createDataClassFix(clazz:DartClass) {
        if (clazz.didChange) {
            const fix = new vscode.CodeAction('Generate data class', vscode.CodeActionKind.QuickFix);
            fix.edit = this.getClazzEdit(clazz);
            return fix;
        }
    }

    constructQuickFix(part: string, description: string) {
        const generator = new DataClassGenerator(this.document!.getText(), null, false, part);
        const fix = new vscode.CodeAction(description, vscode.CodeActionKind.QuickFix);
        const clazz = this.findQuickFixClazz(generator);
        if (clazz !== null && clazz!.didChange) {
            fix.edit = this.getClazzEdit(clazz!, generator.imports);
            return fix;
        }
    }

    findQuickFixClazz(generator: DataClassGenerator) {
        for (let clazz of generator.clazzes!) {
            if (clazz.name === this.clazz!.name)
                {return clazz;}
        }
    }

    getClazzEdit(clazz: DartClass, imports:Imports|null = null) {
        return getReplaceEdit(clazz, imports || this.generator!.imports);
    }

    createConstructorFix() {
        return this.constructQuickFix('constructor', 'Generate constructor');
    }

    createCopyWithFix() {
        return this.constructQuickFix('copyWith', 'Generate copyWith');
    }

    createSerializationFix() {
        return this.constructQuickFix('serialization', 'Generate JSON serialization');
    }

    createToStringFix() {
        return this.constructQuickFix('toString', 'Generate toString');
    }

    createEqualityFix() {
        return this.constructQuickFix('equality', 'Generate equality');
    }

    createUseEquatableFix() {
        return this.constructQuickFix('useEquatable', `Generate Equatable`);
    }

    createImportsFix() {
        const imports = new Imports(this.document!.getText());
        if (!imports.didChange) {return;}

        const inImportsRange = this.lineNumber >= imports.startAtLine! && this.lineNumber <= imports.endAtLine!;
        if (inImportsRange) {
            let title = 'Sort imports';
            if (imports.hasImportDeclaration && imports.hasExportDeclaration) {
                title = 'Sort imports/exports';
            } else if (imports.hasExportDeclaration) {
                title = 'Sort exports';
            }

            return this.createFix(title, (edit) => {
                edit.replace(this.uri, imports.range, imports.formatted);
            });
        }
    }

    getClass() {
        for (let clazz of this.generator!.clazzes!) {
            if (clazz.startsAtLine! <= this.lineNumber && clazz.endsAtLine! >= this.lineNumber) {
                return clazz;
            }
        }
    }
}

export function getReplaceEdit(values:any, imports :Imports| null, showLogs = false) {

    const clazzes = values instanceof DartClass ? [values] : values;
    const hasMultiple = clazzes.length > 1;
    const edit = new vscode.WorkspaceEdit();
    const uri = getDoc()!.uri;

    const noChanges = [];

    let ignoreComment = readSetting("ignoreComment.enabled");
    if (ignoreComment === '') {ignoreComment = 'public_member_api_docs, sort_constructors_first';}
    const lines:any[] = [];
    const ignores:any[]  = [];

    const text = getDocText();
    text!.split("\n").forEach(function (line) {
      if (line.includes("// ignore_for_file:")) {lines.push(line);}
    });
    let isIncluding;
    ignoreComment.split(",").forEach((ignore:any) => {
      ignore.trim();

      isIncluding = false;
      lines.forEach((line) => {
        if (line.includes(ignore)) {
          isIncluding = true;
        }
      });
      for (let line in lines) {
      }
      if (!isIncluding) {ignores.push(ignore);}
    });
    if (ignores.length > 0)
      {edit.insert(
        uri,
        new vscode.Position(0, 0),
        `// ignore_for_file: ${ignores.join(",")}\n`
      );}


    for (var i = clazzes.length - 1; i >= 0; i--) {
        const clazz = clazzes[i];

        if (clazz.isValid) {
            if (clazz.didChange) {
                let replacement = clazz.generateClassReplacement();
                // Seperate the classes with a new line when multiple
                // classes are being generated.
                if (!clazz.isLastInFile) {
                    replacement += '\n';
                }

                if (!isBlank(replacement)) {
                    edit.replace(uri, new vscode.Range(
                        new vscode.Position((clazz.startsAtLine - 1), 0),
                        new vscode.Position(clazz.endsAtLine, 1)
                    ), replacement);
                }
            } else if (showLogs) {
                noChanges.push(clazz.name);
                if (i === 0) {
                    const info = noChanges.length === 1 ? `class ${noChanges[0]}` : `classes ${noChanges.join(', ')}`;
                    showInfo(`No changes detected for ${info}`);
                }
            }
        } else if (showLogs) {
            showError(clazz.issue);
        }
    }

    // If imports need to be inserted, do it at the top of the file.
    if (imports !== null && imports.hasImports) {
        // Imports must be seperated by at least one line because otherwise we get an overlapping range error
        // from the vscode editor.
        const areImportsSeperated = !hasMultiple || (imports.startAtLine || 0) < clazzes[0].startsAtLine - 1;
        if (imports.hasPreviousImports && areImportsSeperated) {
            edit.replace(uri, imports.range, imports.formatted);
        } else {
            edit.insert(uri, new vscode.Position(imports.startAtLine!, 0), imports.formatted + '\n');
        }
    }

    return edit;
}

export function isBlank(str: string) {
    return (!str || /^\s*$/.test(str));
}

export function createFileName(name: string) {
    let r = '';
    for (let i = 0; i < name.length; i++) {
        let c = name[i];
        if (c === c.toUpperCase()) {
            if (i === 0) {r += c.toLowerCase();}
            else {r += '_' + c.toLowerCase();}
        } else {
            r += c;
        }
    }
    return r;
}

export function getCurrentPath() {
    let path = vscode.window.activeTextEditor?.document.fileName;
    let dirs = path!.split("\\");
    path = '';
    for (let i = 0; i < dirs.length; i++) {
        let dir = dirs[i];
        if (i < dirs.length - 1) {
            path += dir + "\\";
        }
    }
    return path;
}

export async function writeFile(content: string, name: string, open = true, path = getCurrentPath()) {
    let p = path + name + '.dart';
    if (fs.existsSync(p)) {
        let i = 0;
        do {
            p = path + name + '_' + ++i + '.dart';
        } while (fs.existsSync(p));
    }

    fs.writeFileSync(p, content, 'utf-8');
    if (open) {
        let openPath = vscode.Uri.parse("file:///" + p);
        let doc = await vscode.workspace.openTextDocument(openPath);
        await vscode.window.showTextDocument(doc);
    }
    return;
}
/*** Make a valid dart variable name from a string.*/
export function toVarName(source: string) {
    let s = source;
    let r = '';
    let replace = (char: string) => {
        if (s.includes(char)) {
            const splits = s.split(char);
            for (let i = 0; i < splits.length; i++) {
                let w = splits[i];
                i > 0 ? r += capitalize(w) : r += w;
            }
        }
    };
    // Replace invalid variable characters like '-'.
    replace('-');
    replace('~');
    replace(':');
    replace('#');
    replace('$');

    if (r.length === 0)
        {r = s;}

    // Prevent dart keywords from being used.
    switch (r) {
        case 'assert': r = 'aAssert'; break;
        case 'break': r = 'bBreak'; break;
        case 'case': r = 'cCase'; break;
        case 'catch': r = 'cCatch'; break;
        case 'class': r = 'cClass'; break;
        case 'const': r = 'cConst'; break;
        case 'continue': r = 'cContinue'; break;
        case 'default': r = 'dDefault'; break;
        case 'do': r = 'dDo'; break;
        case 'else': r = 'eElse'; break;
        case 'enum': r = 'eEnum'; break;
        case 'extends': r = 'eExtends'; break;
        case 'false': r = 'fFalse'; break;
        case 'final': r = 'fFinal'; break;
        case 'finally': r = 'fFinally'; break;
        case 'for': r = 'fFor'; break;
        case 'if': r = 'iIf'; break;
        case 'in': r = 'iIn'; break;
        case 'is': r = 'iIs'; break;
        case 'new': r = 'nNew'; break;
        case 'null': r = 'nNull'; break;
        case 'rethrow': r = 'rRethrow'; break;
        case 'return': r = 'rReturn'; break;
        case 'super': r = 'sSuper'; break;
        case 'switch': r = 'sSwitch'; break;
        case 'this': r = 'tThis'; break;
        case 'throw': r = 'tThrow'; break;
        case 'true': r = 'tTrue'; break;
        case 'try': r = 'tTry'; break;
        case 'var': r = 'vVar'; break;
        case 'void': r = 'vVoid'; break;
        case 'while': r = 'wWhile'; break;
        case 'with': r = 'wWith'; break;
    }

    if (r.length > 0 && r[0].match(new RegExp(/[0-9]/)))
        {r = 'n' + r;}

    return r;
}

export function editorReplace(editor:vscode.TextEditorEdit, start :number| null, end :number| null, value: string) {
    editor.replace(new vscode.Range(
        new vscode.Position(start || 0, 0),
        new vscode.Position(end || getDocText()!.split('\n').length, 1)
    ),
        value
    );
}

export function editorInsert(editor:vscode.TextEditorEdit, at:number, value: string) {
    editor.insert(new vscode.Position(at, 0), value);
}

export function editorDelete(editor:vscode.TextEditorEdit, from: number, to:number) {
    editor.delete(
        new vscode.Range(
            new vscode.Position(from || 0, 0),
            new vscode.Position(to || getDocText()!.split('\n').length, 1)
        )
    );
}

export function scrollTo(from :number, to :number) {
    getEditor()?.revealRange(
        new vscode.Range(
            new vscode.Position(from || 0, 0),
            new vscode.Position(to || 0, 0)
        ),
        0
    );
}

export function clearSelection() {
    getEditor()!.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));
}
export function capitalize(source: string):string {
    let s = source;
    if (s.length > 0) {
        if (s.length > 1) {
            return s.substr(0, 1).toUpperCase() + s.substring(1, s.length);
        } else {
            return s.substr(0, 1).toUpperCase();
        }
    }
    return s;
}
export function removeStart(source: string, start:string | any[]):string {
    if (Array.isArray(start)) {
        let result = source.trim();
        for (let s of start) {
            result = removeStart(result, s).trim();
        }
        return result;
    } else {
        return source.startsWith(start) ? source.substring(start.length, source.length) : source;
    }
}
export function removeEnd(source: string, end:string | any[]):string {
    if (Array.isArray(end)) {
        let result = source.trim();
        for (let e of end) {
            result = removeEnd(result, e).trim();
        }
        return result;
    } else {
        const pos = (source.length - end.length);
        return source.endsWith(end) ? source.substring(0, pos) : source;
    }
}
export function indent(source: string) :string{
    let r:string = '';
    for (let line of source.split('\n')) {
        r += '  ' + line + '\n';
    }
    return r.length > 0 ? r : source;
}
export function count(source: string, match: string): number  {
    let count: number = 0;
    let length: number  = match.length;
    for (let i = 0; i < source.length; i++) {
        let part = source.substr((i * length) - 1, length);
        if (part === match) {
            count++;
        }
    }
    return count;
}
export function areStrictEqual(a: string, b: string):boolean {
    let x = a.replace(/\s/g, "");
    let y = b.replace(/\s/g, "");
    return x === y;
}
export function removeAll(source: string, matches: string[]):string {
    let r:string = '';
    for (let s of source) {
        if (!matches.includes(s)) {
            r += s;
        }
    }
    return r;
}
export function includesOne(source: string, matches: string[], wordBased = true): boolean {
    const words = wordBased ? source.split(' ') : [source];
    for (let word of words) {
        for (let match of matches) {
            if (wordBased) {
                if (word === match)
                    {return true;}
            } else {
                if (source.includes(match))
                    {return true;}
            }
        }
    }
    return false;
}
export function includesAll(source: string, matches: string[]) : boolean {
    for (let match of matches) {
        if (!source.includes(match))
            {return false;}
    }
    return true;
}
export function getDoc():vscode.TextDocument|undefined {
    return getEditor()?.document;
}
export function getEditor() :vscode.TextEditor|undefined{
    return vscode.window.activeTextEditor;
}
export function getDocText():string|undefined {
    return getDoc()?.getText();
}
export function getLangId() :string|undefined {
    return getDoc()?.languageId;
}
export function readSetting(key: string):any {
    return vscode.workspace.getConfiguration().get('sudesh.' + key);
}
export function readSettings(keys: string[]) :boolean{
    for (let key of keys) {
        if (readSetting(key)) {return true;}
    }
    return false;
}
export function showError( msg: string) {
    vscode.window.showErrorMessage(msg);
}
export function showInfo(msg: string) {
    vscode.window.showInformationMessage(msg);
}
