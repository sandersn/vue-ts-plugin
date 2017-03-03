# TypeScript Language Service Plugin for View

WARNING: This plugin is in an alpha state. It depends on unreleased extensions to the TypeScript plugin API that are not in master yet.

This plugin does three things for Javascript and Typescript source in a `.vue` file:

1. It uses `vue-template-compiler` to parse out the script section of a `.vue` file.
2. It wraps a default exported object literal in `new Vue(...)` in order to propagate the Vue contextual type so that no type annotations are needed.
3. It uses the Typescript language service to provide completions.

It also resolves `import other from "other.vue";` statements in the same manner.

## Features left to add

1. Finalise the new extension points on the plugin API.
2. `import Vue from "vue"` not `"./vue"`
3. Recognise ES5-style `module.exports = { ...` in addition to ES6 `export default { ...`.
4. Update to vue-template-compiler's final `pad` option for `parseComponent`.
5. Recognise only lang="javascript", lang="typescript" and no lang attribute. Others should not turn on the language service.


## Current instructions for emacs

TODO: Add detail to each step.

1. Clone typescript.
2. Checkout and build the branch vue-plugin-WIP
3. Set Tide to use your typescript instead of the provided one.
4. From this repo, `$ npm link`
5. From your vue repo, `$ npm link vue-ts-plugin`
6. Add plugin to tsconfig.
7. Set Tide to start `.vue` files in tide-mode.

Now you have typescript support inside the script tags. HTML and CSS support are non-existent right now.

I think that's it.

## Future instructions for VS Code

This is how it will work someday.

1. `$ npm install vue-ts-plugin`
2. Add plugin to tsconfig.
3. Install vetur extension for VS Code.
