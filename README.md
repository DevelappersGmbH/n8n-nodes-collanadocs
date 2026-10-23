# @develappers/n8n-nodes-collanadocs

An [n8n](https://n8n.io) community node for the Collana Docs service — HTML → PDF, ZUGFeRD 2.5 with profile EN 16931 (PDF/A-3 + XML) and XRechnung 3.0 (currently 3.0.2).

More about the service, its plans and its document formats:
[**Collana Docs**](https://www.develappers.de/products/collanadocs)

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
- For `XRechnung` and `PDF With ZUGFeRD`, further fields are mandatory — see
  [Required fields for e-invoices](#required-fields-for-e-invoices).

A template that reads a field the data does not have renders it empty and the request succeeds.
Reading through a missing intermediate object (`d.missing.field` when `d.missing` does not exist)
and Scriban syntax errors fail the request with a 400 whose message names the template part and
the position.

Images must be embedded as `data:` URIs; the renderer does not fetch external URLs, so a logo or any other artwork has to travel inside the template.

Validation errors come back verbatim from the service, naming the offending JSON path.

See [examples](examples) for five complete working requests — an offer as PDF, the matching invoice both as PDF with ZUGFeRD and as XRechnung XML, a credit note on that invoice, and an XRechnung to a public-sector buyer with a Leitweg-ID — each with an importable n8n workflow.

### Required fields for e-invoices

These rules apply from Collana Docs **1.10.0**. An older instance ignores fields it does not know
(the schema allows additional properties), so a credit note or a Leitweg-ID sent to it is not
rejected but silently missing from the e-invoice.

A request for `XRechnung` or `PDF With ZUGFeRD` that misses any of these fields is rejected with a
400 listing all missing fields by their path. Invalid values — a foreign currency, a tax number
instead of a VAT ID, an invalid Leitweg-ID or electronic address scheme — are rejected one at a
time, the currency first. Some of these messages are in German. `PDF Only` requires none of the
fields.

`<buyer>` is `recipient` if `recipient.company.name` is set, otherwise `customer`; the error names
the party actually used.

| Field | XRechnung | PDF With ZUGFeRD | Condition |
| --- | --- | --- | --- |
| `document.number`, `document.date` | ✓ | ✓ | – |
| `sender.company.name`, `sender.address.street.line1`, `sender.address.city` | ✓ | ✓ | – |
| `<buyer>.company.name`, `<buyer>.address.street.line1`, `<buyer>.address.city` | ✓ | ✓ | – |
| `line_items[]` | ✓ | ✓ | at least one entry with `line_type` `article` (BR-16) |
| `payment.terms` or `payment.due_date` | ✓ | ✓ | while an amount is due (BR-CO-25) |
| `sender.company.tax_number` | ✓ | ✓ | VAT ID with country prefix, e.g. `DE123456789` — a German tax number (Steuernummer) is rejected; the same applies to `<buyer>.company.tax_number` if set |
| `sender.contact_details.email` | ✓ | – | seller contact and electronic address (BR-DE-2) |
| `sender.contact_details.phone` | ✓ | – | seller contact (BR-DE-6) |
| `sender.bank.iban` | ✓ | – | payment instructions (BR-DE-1) |
| `<buyer>.electronic_address`, `<buyer>.leitweg_id`, `<buyer>.contact_details.email` or `<buyer>.company.tax_number` | one of them | – | buyer's electronic address (BT-49) |
| `<buyer>.electronic_address.scheme_id` and `.id` | ✓ | ✓ | both, once either is set; `scheme_id` from the CEF EAS code list, case-sensitive (`EM`, not `em`) |
| `references.preceding_invoices[]` | ✓ | ✓ | required for `document.invoice_type` `correction`, recommended for `credit_note`; an entry with a `date` needs a `number` |
| `totals.allowances[]` / `totals.charges[]` | ✓ | ✓ | once a document discount, freight or packaging falls on line items with several VAT rates |

- **Buyer's electronic address:** the explicit `electronic_address` (e.g. a Peppol ID) wins, then
  the Leitweg-ID, then the buyer's email, then the buyer's VAT ID. A domestic business customer
  without a VAT ID only needs an email address.
- **Public sector:** German public-sector buyers route e-invoices by their Leitweg-ID, set as
  `<buyer>.leitweg_id`. It becomes the buyer reference and, unless `electronic_address` is set, the
  electronic address. The service checks its format and check digits and rejects an invalid one
  with a 400. Where an authority's Peppol ID differs from its Leitweg-ID, put the Peppol ID into
  `<buyer>.electronic_address`, e.g. `{ "scheme_id": "0204", "id": "04000000-FHBXLAND-82" }`.
- **Invoice type:** `document.invoice_type` is `invoice` (default), `partial_invoice`,
  `credit_note` or `correction`. `credit_note` (type code 381) is a credit note correcting an
  invoice in the customer's favour, not a self-billed invoice (Gutschrift under § 14 (2) UStG).
  It carries positive amounts; the invoices it refers to go into
  `references.preceding_invoices[]` as `{ "number", "date" }`.
- **Formats:** dates as `DD.MM.YYYY`, amounts in German notation as strings (`"1.234,56"`).
- **Currency:** e-invoices are issued in EUR only. A `document.currency` other than empty or `EUR`
  is rejected with a 400; `PDF Only` is not affected.

The authoritative list is the service's own validation; its error message names every missing
field.

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

## Contributing

Bug reports, feature requests and pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for the setup, the ground rules and what makes a useful bug
report. Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

Security issues do not belong in a public issue: mail info.dev@collana.com instead.

## License

[MIT](LICENSE)
