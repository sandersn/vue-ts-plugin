import * as ts_module from "../node_modules/typescript/lib/tsserverlibrary";
import { parseComponent } from 'vue-template-compiler';
declare var parseComponent: (text: string, options?: { pad?: boolean }) => {
    script: {
        start: number,
        end: number,
        content: string
    }
};

function init({ typescript: ts } : {typescript: typeof ts_module}) {

    function create(info: ts.server.PluginCreateInfo) {
        return info.languageService;
    }

    function changeSourceFiles(info: ts.server.PluginCreateInfo) {
        const logger = info.project.projectService.logger;
        const clssf = ts.createLanguageServiceSourceFile;
        const ulssf = ts.updateLanguageServiceSourceFile;
        const usf = ts.updateSourceFile;
        function createLanguageServiceSourceFile(fileName: string, scriptSnapshot: ts.IScriptSnapshot, scriptTarget: ts.ScriptTarget, version: string, setNodeParents: boolean, scriptKind?: ts.ScriptKind, cheat?: string): ts.SourceFile {
            logger.info(`*** hooked createLanguageServiceSourceFile for ${fileName} *****`);
            cheat = interested(fileName) ? parse(fileName, scriptSnapshot.getText(0, scriptSnapshot.getLength())) : cheat;
            logger.info(`*** ${cheat}`);
            var sourceFile = clssf(fileName, scriptSnapshot, scriptTarget, version, setNodeParents, scriptKind, cheat);
            if (interested(fileName)) {
                modifyVueSource(sourceFile, logger);
            }
            return sourceFile;
        }

        ts.updateSourceFile = function(sourceFile: ts.SourceFile, newText: string, textChangeRange: ts.TextChangeRange, aggressiveChecks?: boolean) {
            logger.info(`*** hooked updateSourceFile for ${sourceFile.fileName}`);
            return usf(sourceFile, newText, textChangeRange, aggressiveChecks);
        };

        // TODO: Next fix this code so that it works
        // (by the way, replacing updateSourceFile doesn't seem to work)
        function updateLanguageServiceSourceFile(sourceFile: ts.SourceFile, scriptSnapshot: ts.IScriptSnapshot, version: string, textChangeRange: ts.TextChangeRange, aggressiveChecks?: boolean, cheat?: string): ts.SourceFile {
            logger.info(`*** hooked updateLanguageServiceSourceFile for ${sourceFile.fileName}`);
            cheat = interested(sourceFile.fileName) ? parse(sourceFile.fileName, scriptSnapshot.getText(0, scriptSnapshot.getLength())) : cheat;
            if (cheat && textChangeRange) {
                logger.info(`**** span: ${textChangeRange.span.start}+${textChangeRange.span.length} --> ${textChangeRange.newLength}`);
            }
            var sourceFile = ulssf(sourceFile, scriptSnapshot, version, textChangeRange, aggressiveChecks, cheat);
            if (interested(sourceFile.fileName)) {
                modifyVueSource(sourceFile, logger);
            }
            return sourceFile;
        }

        return { createLanguageServiceSourceFile, updateLanguageServiceSourceFile };
    }

    function interested(filename: string): boolean {
        // if all we get is the content I could work with that too I guess
        return filename.slice(filename.lastIndexOf('.')) === ".vue";
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
        logger.info(`***** post: number of statements: ${sourceFile.statements.length}`);
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

    return { create, interested, getExternalFiles, changeSourceFiles };
}

export = init;
