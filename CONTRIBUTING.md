# Contributing

Thanks for taking the time to contribute to `@develappers/n8n-nodes-collanadocs`.

This node is the n8n front end for the Collana Docs service. Anything about the service itself —
the JSON schema, the rendering, ZUGFeRD or XRechnung conformance — lives on the product side:
see [collanadocs](https://www.develappers.de/products/collanadocs). What is in this repository is
the node: its parameters, the request it builds, and the documentation around it.

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report unacceptable
behaviour to info.dev@collana.com.

## Reporting bugs and asking for features

Open an [issue](https://github.com/DevelappersGmbH/n8n-nodes-collanadocs/issues). A useful bug
report has:

- the node version and your n8n version,
- what you expected and what happened instead,
- the error n8n showed, verbatim — the service names the offending JSON path in validation errors,
  and that path is usually the whole answer,
- a minimal **Document Data** payload that reproduces it.

Please strip credentials, client secrets and real customer data before pasting anything.

**Do not report security issues in a public issue.** Mail info.dev@collana.com instead.

## Development setup

Node.js ≥ 20.15 is required (see `engines` in `package.json`).

```bash
npm install
npm run dev       # downloads and starts a local n8n with this node, rebuilding on change
npm run build     # compile to dist/ and copy the icons and codex file
npm run test      # vitest, once
npm run lint      # n8n community-node rules, incl. the n8n Cloud compatibility checks
npm run lint:fix  # the same, with auto-fixes applied
```

`npm run dev` stays in the foreground — that is a watcher, not a hang. Stop it with `Ctrl+C`.

## Ground rules for changes

- **No runtime dependencies.** n8n Cloud requires the package to ship without them, and
  `npm run lint` fails if one is added. Keep it that way.
- **`npm run lint` and `npm run test` must pass** before you open a pull request. Formatting follows
  `.prettierrc.js`; `npm run lint:fix` applies it.
- **Cover behaviour with tests.** The suite under [`test/`](test) exercises the request the node
  builds and the credential test. A change to either belongs there too.
- **Keep the README honest.** If a parameter, an output field or the data contract changes, the
  README changes in the same pull request.
- **Examples are verified, not illustrative.** Everything in [`examples/`](examples) has been run
  end to end against a live instance. If you add or change one, run it and say so in the pull
  request.

## Pull requests

1. Branch off `main`.
2. Keep the change focused — one topic per pull request.
3. Describe what changed and how you verified it. If it touches the generated document, attach or
   describe the output you got.
4. A maintainer reviews and merges. Releases are cut by the maintainers with `npm run release`,
   which tags and triggers the publish workflow.

## Licence

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
