# Examples

## `offer/` — a scaffolding offer rendered to PDF

A complete, working request for `POST /v1/generate`, verified against a live instance.

Spreebogen Gerüstbau GmbH is invented. Its identifiers are deliberately taken from ranges that
cannot collide with a real company, yet still pass a format or checksum check, so the sample looks
right in a rendered document without pointing at anybody:

- the IBAN carries a valid ISO 13616 checksum over bank code `99999999`, which is not assigned,
- the phone number sits in `030 23125 xxx`, the block the Bundesnetzagentur reserves for fiction,
- `.example` is reserved for documentation by RFC 2606,
- the VAT ID passes the German Modulo 11,10 check.

The sample deliberately exercises the trickier parts of the template:

- a `text` line item without position or price, alongside priced `article` items,
- a second address block that stays hidden because `recipient.company.name` is empty,
- a VAT rate (7 %) listed in `totals.vat_rates` that no line item uses, so the template
  has to suppress that row.

| File | Sent as |
| --- | --- |
| `document.json` | Document Data |
| `body.html` | Body Template |
| `header.html` | Header Template |
| `footer.html` | Footer Template |
| `styles.css` | Style Sheet |
| `i18n.json` | Localization Data |
| `workflow.json` | importable n8n workflow wiring all of the above into the node |

To try it: import `workflow.json` in n8n (**Workflows → Import from File**), attach a
Collana Docs API credential to the node, and run it.

Header and footer share one decorative graphic, rotated 180° for the header. It is embedded as a
`data:` URI, because the renderer does not fetch external URLs — every image has to travel inside
the template, which is why the two files are around 25 KB each.

### Document data contract

The service validates `document.json` against its own JSON schema and is strict about it:

- `schema_version` must be the integer `1`, at the root.
- A `document` object must be present at the root.
- **Every numeric value is a string**: `position`, `tax_rate`, `quantity`, `unit_price`,
  `net_amount`, `totals.*` and `vat_rates[].rate`. Sending `19` instead of `"19"` is rejected.
- For `XRechnung` and `PdfMitZugferd`, the invoice fields are mandatory: `invoice_number`,
  `invoice_date`, `sender_name`, `sender_address`, `sender_city`, `customer_name`,
  `customer_address`, `customer_city`, and at least one `line_items` entry (BR-16).

A template that reads a field the data does not have makes the whole request fail with a 500 —
there is no silent fallback to an empty string, so keep templates and data in sync.
