# TypeScript Language Service Plugin for View

WARNING: This plugin is in an alpha state. It depends on unreleased extensions to the TypeScript plugin API that are not in master yet.

This plugin does three things for Javascript and Typescript source in a `.vue` file:

1. It uses `vue-template-compiler` to parse out the script section of a `.vue` file.
2. It wraps a default exported object literal in `new Vue(...)` in order to propagate the Vue contextual type so that no type annotations are needed.
3. It uses the Typescript language service to provide completions.

It also resolves `import other from "other.vue";` statements in the same manner.
