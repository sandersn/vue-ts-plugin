import * as ts_module from "../node_modules/typescript/lib/tsserverlibrary";

function init(modules: {typescript: typeof ts_module}) {
    const ts = modules.typescript;

    function create(info: ts.server.PluginCreateInfo) {
        // TODO: Maybe hook the document registry?
        // or add methods to the language service host, onCreateSourceFile/onUpdateSourceFile and add them as before/after advice.
        // but first, just try directly replacing the methods on ts!! yay!
        // Or just try to allow replacement of createSourceFile
        // Get a list of things to remove from the completion list from the config object.
        // If nothing was specified, we'll just remove 'caller'
        const whatToRemove: string[] = info.config.remove || ['caller'];

        // Diagnostic logging
        info.project.projectService.logger.info("This message will appear in your logfile if the plugin loaded correctly");

        // Set up decorator
        const proxy = Object.create(null) as ts.LanguageService;
        const oldLS = info.languageService;
        for (const k in oldLS) {
            (proxy as any)[k] = function () {
                return oldLS[k].apply(oldLS, arguments);
            }
        }

        const csf = ts.createSourceFile;
        const usf = ts.updateSourceFile;
        ts.createSourceFile = function (filename: string, sourceText: string, languageVersion: ts.ScriptTarget, setParentNodes?: boolean, scriptKind?: ts.ScriptKind) {
            info.project.projectService.logger.info('****** hooked createSourceFile *****');
            if (interested(filename)) {
                // TODO: Cheat and expose the scanner instead, then replace the scanner.setText call
                info.project.projectService.logger.info(`****** interested: ${filename} *****`);
                const start = sourceText.indexOf("<script>") === -1 ? 0 : sourceText.indexOf("<script>") + "<script>".length;
                const end = sourceText.indexOf("</script>");
                sourceText = sourceText.slice(start, end);
            }
            return csf(filename, sourceText, languageVersion, setParentNodes, scriptKind);
        }
        ts.updateSourceFile = function (sourcefile: ts.SourceFile, newText: string, textChangeRange: ts.TextChangeRange, aggressiveChecks?: boolean) {
            // hmmm looks like this one isn't really used
            info.project.projectService.logger.info('****** hooked updateSourceFile *****');
            return usf(sourcefile, newText, textChangeRange, aggressiveChecks);
        }

        return proxy;
    }

    function interested(filename: string): boolean {
        // if all we get is the content I could work with that too I guess
        return filename.slice(filename.lastIndexOf('.')) === ".vue";
    }

    return { create, interested };
}

export = init;
