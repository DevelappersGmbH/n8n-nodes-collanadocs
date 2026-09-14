# n8n-nodes-collanadocs

An [n8n](https://n8n.io) community node for the Collana Docs service — HTML → PDF (Gotenberg),
ZUGFeRD 2.3 (PDF/A-3 + XML) and XRechnung 3.x.

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter `n8n-nodes-collanadocs`.

For a self-hosted instance you can also install it manually:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-collanadocs
```

## Credentials

Create a **Collana Docs API** credential with:

| Field | Description |
| --- | --- |
| Base URL | Root URL of your instance, e.g. `https://pdfgen.develappers-staging.de` |
| Client Secret | Shared secret, sent as the `X-Client-Secret` header |

The secret is the one the service requires for its `/v1/generate` endpoints.

## Operations

| Operation | Endpoint |
| --- | --- |
| Generate Document | `POST /v1/generate` |
| Generate Offer | `POST /v1/generate/offer` |

Both accept the same parameters.

### Parameters

- **Output Format** — `PDF Only`, `PDF With ZUGFeRD` or `XRechnung (XML)`.
- **Document Data** — the payload as JSON or Business Central XML. Reachable in the templates
  as `d.*`.
- **Body / Header / Footer Template** — Scriban/HTML fragments. Header and footer are rendered on
  every page.
- **Style Sheet** — CSS applied to header, body and footer.
- **Localization Data** — one or more localization JSON documents, reachable as `t.*`.
- **Margins** — `top`, `right`, `bottom`, `left`, each including its unit (`20mm`). Omitted sides
  fall back to the service defaults.
- **Options → Image Input Binary Field** — name of an input binary field whose image is uploaded
  with the request, for example a logo referenced from the templates.
- **Options → Put Output File in Field** — output binary field for the generated document
  (default `data`).
- **Options → File Name** — overrides the name the service reports.

Templates, style sheet, localization and margins are hidden for `XRechnung`, which produces XML
without rendering a page.

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

```bash
npm install
npm run build     # compile to dist/ and copy icons
npm run lint      # eslint incl. the n8n community-node rules
npm run format    # prettier
```

To try the node in a local n8n:

```bash
npm run build
npm link
cd ~/.n8n/nodes && npm link n8n-nodes-collanadocs
n8n start
```

## License

[MIT](LICENSE)
