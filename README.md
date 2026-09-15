# @develappers/n8n-nodes-collanadocs

An [n8n](https://n8n.io) community node for the Collana Docs service — HTML → PDF (Gotenberg), ZUGFeRD 2.3 (PDF/A-3 + XML) and XRechnung 3.x.

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter `@develappers/n8n-nodes-collanadocs`.

For a self-hosted instance you can also install it manually:

```bash
cd ~/.n8n/nodes
npm install @develappers/n8n-nodes-collanadocs
```

## Credentials

Create a **Collana Docs API** credential with:

| Field | Description |
| --- | --- |
| Base URL | Root URL of your instance. Defaults to `https://collanadocs.develappers.de`; point it at your own deployment if you run one. |
| Client Secret | Shared secret, sent as the `X-Client-Secret` header |

The secret is the one the service requires for its `/v1` endpoints. **Test** on the credential calls
`GET /v1/auth/check`, which verifies the secret without rendering a document.

## What it does

The node renders one document per input item through `POST /v1/generate`.

### Parameters

- **Output Format** — `PDF Only`, `PDF With ZUGFeRD` or `XRechnung (XML)`.
- **Document Data** — the payload as JSON or Business Central XML. Reachable in the templates
  as `d.*`.
- **Body / Header / Footer Template** — Scriban/HTML fragments. Header and footer are rendered on
  every page.
- **Style Sheet** — CSS applied to header, body and footer.
- **Localization Data** — the localization document as JSON, reachable as `t.*`. Required for PDF
  output; the service rejects a PDF request that carries none. The node sends exactly one, so pick
  the language in the workflow and pass that document.
- **Margins** — `top`, `right`, `bottom`, `left`, each including its unit (`20mm`). Omitted sides
  fall back to the service defaults.
- **Options → Put Output File in Field** — output binary field for the generated document
  (default `data`).
- **Options → File Name** — overrides the name the service reports.

Templates, style sheet, localization and margins are hidden for `XRechnung`, which produces XML without rendering a page.

## Templates and n8n expressions

Scriban and n8n both use `{{ }}`. Paste a template into a field that is switched to **Expression**
and n8n tries to evaluate the template itself, which fails with `[ERROR: invalid syntax]`.

Keep the four template fields on **Fixed**. Hover the parameter and use the Fixed/Expression toggle; on Fixed the text is passed through untouched, braces and all.

Expression mode is still the right choice when the template comes from somewhere else — the field
then holds a single expression such as `{{ $json.bodyTemplate }}`, and the Scriban braces arrive in
the data rather than in the field.

## Document data contract

The service validates **Document Data** against its own JSON schema and is strict about it:

- `schema_version` must be the integer `1`, at the root.
- A `document` object must be present at the root.
- **Every numeric value is a string** — `position`, `tax_rate`, `quantity`, `unit_price`,
  `net_amount`, `totals.*` and `vat_rates[].rate`. Sending `19` instead of `"19"` is rejected.
- For `XRechnung` and `PDF With ZUGFeRD`, the invoice fields are mandatory: `invoice_number`,
  `invoice_date`, `sender_name`, `sender_address`, `sender_city`, `customer_name`,
  `customer_address`, `customer_city`, and at least one `line_items` entry (BR-16).

A template that reads a field the data does not have fails the whole request with a 500 — there is no silent fallback to an empty string, so keep templates and data in sync.

Images must be embedded as `data:` URIs; the renderer does not fetch external URLs, so a logo or any other artwork has to travel inside the template.

Validation errors come back verbatim from the service, naming the offending JSON path.

See [examples](examples) for three complete working requests — an offer as PDF, and the matching invoice both as PDF with ZUGFeRD and as XRechnung XML — each with an importable n8n workflow.

## Output

Each item carries the generated document as binary data, plus metadata on `json`:

```json
{
  "fileName": "invoice.pdf",
  "mimeType": "application/pdf",
  "fileSize": 48213,
  "outputFormat": "PdfMitZugferd"
}
```

## Development

The package uses [`@n8n/node-cli`](https://www.npmjs.com/package/@n8n/node-cli), the official
community-node tooling.

```bash
npm install
npm run dev       # downloads and starts a local n8n with this node, rebuilding on change
npm run build     # compile to dist/ and copy the icons and codex file
npm run lint      # n8n community-node rules, incl. the n8n Cloud compatibility checks
npm run lint:fix  # the same, with auto-fixes applied
```

`npm run dev` stays in the foreground — that is a watcher, not a hang. Stop it with `Ctrl+C`.

The package ships without runtime dependencies, which n8n Cloud requires; `npm run lint` fails if
one is added.

## License

[MIT](LICENSE)
