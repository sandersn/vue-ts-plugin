import * as ts_module from "../node_modules/typescript/lib/tsserverlibrary";
import { parseComponent } from "vue-template-compiler";
import path = require('path');

function init({ typescript: ts } : {typescript: typeof ts_module}) {
    return { create, getExternalFiles };

    function create(info: ts.server.PluginCreateInfo) {
        changeSourceFiles(info);
        info.languageServiceHost.resolveModuleNames = (moduleNames, containingFile) => {
            const options = info.languageServiceHost.getCompilationSettings();
            return bifilterMap(moduleNames, importInterested,
                               name => ({
                                   resolvedFileName: path.join(path.dirname(containingFile), path.basename(name)),
                                   extension: ts_module.Extension.Ts
                               }),
                               name => ts.resolveModuleName(name, containingFile, options, ts.sys).resolvedModule);
        };

       return info.languageService;
    }

    function changeSourceFiles(info: ts.server.PluginCreateInfo) {
        const clssf = ts.createLanguageServiceSourceFile;
        const ulssf = ts.updateLanguageServiceSourceFile;
        function createLanguageServiceSourceFile(fileName: string, scriptSnapshot: ts.IScriptSnapshot, scriptTarget: ts.ScriptTarget, version: string, setNodeParents: boolean, scriptKind?: ts.ScriptKind, cheat?: string): ts.SourceFile {
            if (interested(fileName)) {
                const wrapped = scriptSnapshot;
                scriptSnapshot = {
                    getChangeRange: old => wrapped.getChangeRange(old),
                    getLength: () => wrapped.getLength(),
                    getText: (start, end) => parse(fileName, wrapped.getText(0, wrapped.getLength())).slice(start, end),
                };
            }
            var sourceFile = clssf(fileName, scriptSnapshot, scriptTarget, version, setNodeParents, scriptKind);
            if (interested(fileName)) {
                modifyVueSource(sourceFile);
            }
            return sourceFile;
        }

        function updateLanguageServiceSourceFile(sourceFile: ts.SourceFile, scriptSnapshot: ts.IScriptSnapshot, version: string, textChangeRange: ts.TextChangeRange, aggressiveChecks?: boolean, cheat?: string): ts.SourceFile {
            if (interested(sourceFile.fileName)) {
                const wrapped = scriptSnapshot;
                scriptSnapshot = {
                    getChangeRange: old => wrapped.getChangeRange(old),
                    getLength: () => wrapped.getLength(),
                    getText: (start, end) => parse(sourceFile.fileName, wrapped.getText(0, wrapped.getLength())).slice(start, end),
                };
            }
            var sourceFile = ulssf(sourceFile, scriptSnapshot, version, textChangeRange, aggressiveChecks);
            if (interested(sourceFile.fileName)) {
                modifyVueSource(sourceFile);
            }
            return sourceFile;
        }
        ts.createLanguageServiceSourceFile = createLanguageServiceSourceFile;
        ts.updateLanguageServiceSourceFile = updateLanguageServiceSourceFile;
    }


    function interested(filename: string): boolean {
        return filename.slice(filename.lastIndexOf('.')) === ".vue";
    }

    function importInterested(filename: string): boolean {
        return interested(filename) && filename.slice(0, 2) === "./";
    }

    function parse(fileName: string, text: string) {
        const output = parseComponent(text, { pad: "space" });
        return output && output.script && output.script.content;
    }

    /** Works like Array.prototype.find, returning `undefined` if no element satisfying the predicate is found. */
    function find<T>(array: T[], predicate: (element: T, index: number) => boolean): T | undefined {
        for (let i = 0; i < array.length; i++) {
            const value = array[i];
            if (predicate(value, i)) {
                return value;
            }
        }
        return undefined;
    }

    /** Maps elements with one of two functions depending on whether the predicate is true */
    function bifilterMap<T, U>(l: T[], predicate: (t: T) => boolean, yes: (t: T) => U, no: (t: T) => U): U[] {
        const result = [];
        for (const x of l) {
            result.push(predicate(x) ? yes(x) : no(x));
        }
        return result;
    }

    function modifyVueSource(sourceFile: ts.SourceFile): void {
        // 1. add `import Vue from './vue'
        // 2. find the export default and wrap it in `new Vue(...)` if it exists and is an object literal
        //logger.info(sourceFile.getStart() + "-" + sourceFile.getEnd());
        const exportDefaultObject = find(sourceFile.statements, st => st.kind === ts.SyntaxKind.ExportAssignment &&
                                         (st as ts.ExportAssignment).expression.kind === ts.SyntaxKind.ObjectLiteralExpression);
        var b = <T extends ts.Node>(n: T) => ts.setTextRange(n, { pos: 0, end: 0 });
        if (exportDefaultObject) {
            //logger.info(exportDefaultObject.toString());
            const vueImport = b(ts.createImportDeclaration(undefined,
                                                           undefined,
                                                           b(ts.createImportClause(b(ts.createIdentifier("Vue")), undefined)),
                                                           b(ts.createLiteral("vue"))));
            sourceFile.statements.unshift(vueImport);
            const obj = (exportDefaultObject as ts.ExportAssignment).expression as ts.ObjectLiteralExpression;
            (exportDefaultObject as ts.ExportAssignment).expression = ts.setTextRange(ts.createNew(ts.setTextRange(ts.createIdentifier("Vue"), { pos: obj.pos, end: obj.pos + 1 }),
                                                                                                   undefined,
                                                                                                   [obj]),
                                                                                      obj);
            ts.setTextRange(((exportDefaultObject as ts.ExportAssignment).expression as ts.NewExpression).arguments, obj);
        }
    }

    function getExternalFiles(project: ts_module.server.ConfiguredProject) {
        return project.getFileNames().filter(interested);
    }
}

export = init;
