import * as ts_module from "../node_modules/typescript/lib/tsserverlibrary";
import { parseComponent } from "vue-template-compiler";
import path = require('path');
declare var parseComponent: (text: string, options?: { pad?: boolean }) => {
    script: {
        start: number,
        end: number,
        content: string
    }
};

function init({ typescript: ts } : {typescript: typeof ts_module}) {
    return { create, interested, getExternalFiles, changeSourceFiles, resolveModules };

    function create(info: ts.server.PluginCreateInfo) {
        return info.languageService;
    }

    function resolveModules(info: ts.server.PluginCreateInfo) {
        const logger = info.project.projectService.logger;
        return (rmn: any) =>
            (moduleName: string, containingFile: string, compilerOptions: ts.CompilerOptions, host: ts.ModuleResolutionHost, cache?: ts.ModuleResolutionCache) => {
                logger.info(`*** hooked resolveModuleName for ${moduleName}`);
                if (importInterested(moduleName)) {
                    logger.info(`**** interested in ${moduleName} in ${containingFile}`);
                    return {
                        resolvedModule: {
                            // TODO: Figure out what Extension.Ts does and whether I need to add (1) external or (2) Vue
                            // used in module resolution not in determining the content
                            extension: ts_module.Extension.Ts,
                            isExternalLibraryImport: true,
                            resolvedFileName: path.join(path.dirname(containingFile), path.basename(moduleName)),
                        }
                    }
                }
                else {
                    return rmn(moduleName, containingFile, compilerOptions, host, cache);
                }
            };
    }

    function changeSourceFiles(info: ts.server.PluginCreateInfo) {
        const logger = info.project.projectService.logger;
        const clssf = ts.createLanguageServiceSourceFile;
        const ulssf = ts.updateLanguageServiceSourceFile;
        const usf = ts.updateSourceFile;
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
                modifyVueSource(sourceFile, logger);
            }
            return sourceFile;
        }

        function updateLanguageServiceSourceFile(sourceFile: ts.SourceFile, scriptSnapshot: ts.IScriptSnapshot, version: string, textChangeRange: ts.TextChangeRange, aggressiveChecks?: boolean, cheat?: string): ts.SourceFile {
            if (interested(sourceFile.fileName)) {
                if (textChangeRange) {
                    logger.info(`**** span: ${textChangeRange.span.start}+${textChangeRange.span.length} --> ${textChangeRange.newLength}`);
                }
                const wrapped = scriptSnapshot;
                scriptSnapshot = {
                    getChangeRange: old => wrapped.getChangeRange(old),
                    getLength: () => wrapped.getLength(),
                    getText: (start, end) => parse(sourceFile.fileName, wrapped.getText(0, wrapped.getLength())).slice(start, end),
                };
            }
            var sourceFile = ulssf(sourceFile, scriptSnapshot, version, textChangeRange, aggressiveChecks);
            if (interested(sourceFile.fileName)) {
                modifyVueSource(sourceFile, logger);
            }
            return sourceFile;
        }

        return { createLanguageServiceSourceFile, updateLanguageServiceSourceFile };
    }


    function interested(filename: string): boolean {
        return filename.slice(filename.lastIndexOf('.')) === ".vue";
    }

    function importInterested(filename: string): boolean {
        return interested(filename) && filename.slice(0, 2) === "./";
    }

    function parse(fileName: string, text: string) {
        const output = parseComponent(text, { pad: true });
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

    function modifyVueSource(sourceFile: ts.SourceFile, logger: ts_module.server.Logger): void {
        logger.info(`***** before insertion: number of statements: ${sourceFile.statements.length}`);
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
                                                           b(ts.createImportClause(undefined,
                                                                                   b(ts.createNamedImports([
                                                                                       b(ts.createImportSpecifier(
                                                                                           b(ts.createIdentifier("Vue")),
                                                                                           b(ts.createIdentifier("Vue"))))])))),
                                                           b(ts.createLiteral("./vue"))));
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
