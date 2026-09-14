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

## What it does

The node renders one document per input item through `POST /v1/generate`.

The service also exposes `POST /v1/generate/offer`, which the node deliberately does not use: that
endpoint always renders a PDF and rejects a request without templates, so it silently ignores an
`XRechnung` output format. `/v1/generate` covers the same ground without that trap.

### Parameters

- **Output Format** — `PDF Only`, `PDF With ZUGFeRD` or `XRechnung (XML)`.
- **Document Data** — the payload as JSON or Business Central XML. Reachable in the templates
  as `d.*`.
- **Body / Header / Footer Template** — Scriban/HTML fragments. Header and footer are rendered on
  every page.
- **Style Sheet** — CSS applied to header, body and footer.
- **Localization Data** — one or more localization JSON documents, reachable as `t.*`. Required
  for PDF output; the service rejects a PDF request that carries none.
- **Margins** — `top`, `right`, `bottom`, `left`, each including its unit (`20mm`). Omitted sides
  fall back to the service defaults.
- **Options → Image Input Binary Field** — name of an input binary field whose image is uploaded
  with the request, for example a logo referenced from the templates.
- **Options → Put Output File in Field** — output binary field for the generated document
  (default `data`).
- **Options → File Name** — overrides the name the service reports.

Templates, style sheet, localization and margins are hidden for `XRechnung`, which produces XML
without rendering a page.

## Document data contract

The service validates **Document Data** against its own JSON schema and is strict about it:

- `schema_version` must be the integer `1`, at the root.
- A `document` object must be present at the root.
- **Every numeric value is a string** — `position`, `tax_rate`, `quantity`, `unit_price`,
  `net_amount`, `totals.*` and `vat_rates[].rate`. Sending `19` instead of `"19"` is rejected.
- For `XRechnung` and `PDF With ZUGFeRD`, the invoice fields are mandatory: `invoice_number`,
  `invoice_date`, `sender_name`, `sender_address`, `sender_city`, `customer_name`,
  `customer_address`, `customer_city`, and at least one `line_items` entry (BR-16).

A template that reads a field the data does not have fails the whole request with a 500 — there
is no silent fallback to an empty string, so keep templates and data in sync.

Images must be embedded as `data:` URIs; the renderer does not fetch external URLs. Use the
**Image Input Binary Field** option to pass one image alongside the request instead.

Validation errors come back verbatim from the service, naming the offending JSON path.

See [examples/offer](examples/offer) for a complete working request, including an importable
n8n workflow.

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
