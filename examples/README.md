# Examples

Three complete requests, each verified end to end against a live instance. Every folder holds the
loose source files plus a `workflow.json` you can import into n8n (**Workflows → Import from File**);
attach a Collana Docs API credential to the node and run it.

| Folder | Output Format | Produces |
| --- | --- | --- |
| [`offer/`](offer) | `NurPdf` | a scaffolding offer as a plain PDF |
| [`invoice-zugferd/`](invoice-zugferd) | `PdfMitZugferd` | the matching invoice as PDF/A-3 with an embedded `factur-x.xml` |
| [`invoice-xrechnung/`](invoice-xrechnung) | `XRechnung` | the same invoice as XRechnung XML |

The two invoice folders describe **the same invoice**, RE-2026-0187, over the same scaffolding job
as the offer. They differ only in what the service is asked to return.

Note what `invoice-xrechnung/` does *not* contain: no templates, no stylesheet, no localization.
`XRechnung` produces XML without rendering a page, so the document data is the whole input. That is
also why the node hides those fields once you pick that output format.

## Files

| File | Sent as |
| --- | --- |
| `document.json` | Document Data |
| `body.html` | Body Template |
| `header.html` | Header Template |
| `footer.html` | Footer Template |
| `styles.css` | Style Sheet |
| `i18n.json` | Localization Data |

Header and footer share one decorative graphic, rotated 180° for the header. It is embedded as a
`data:` URI, because the renderer does not fetch external URLs — every image has to travel inside
the template, which is why those two files are around 25 KB each.

The templates, stylesheet and localization are duplicated across folders rather than shared, so
each example can be lifted out on its own.

## The fictional company

Spreebogen Gerüstbau GmbH is invented. Its identifiers are deliberately taken from ranges that
cannot collide with a real company, yet still pass a format or checksum check, so the samples look
right in a rendered document without pointing at anybody:

- the IBAN carries a valid ISO 13616 checksum over bank code `99999999`, which is not assigned,
- the phone number sits in `030 23125 xxx`, the block the Bundesnetzagentur reserves for fiction,
- `.example` is reserved for documentation by RFC 2606,
- the VAT ID passes the German Modulo 11,10 check.

## What the samples exercise

- a `text` line item without position or price, alongside priced `article` items,
- a second address block that stays hidden because `recipient.company.name` is empty,
- a VAT rate (7 %) listed in `totals.vat_rates` that no line item uses, so the template has to
  suppress that row,
- on the invoice, the optional `order_number`, `delivery_note_number` and `payment_due_date` rows,
  each wrapped in a guard so the template still renders when they are absent.

## Document data contract

The service validates `document.json` against its own JSON schema and is strict about it:

- `schema_version` must be the integer `1`, at the root.
- A `document` object must be present at the root.
- **Every numeric value is a string**: `position`, `tax_rate`, `quantity`, `unit_price`,
  `net_amount`, `totals.*` and `vat_rates[].rate`. Sending `19` instead of `"19"` is rejected.
- For `XRechnung` and `PdfMitZugferd` the invoice fields are mandatory. The service reports them
  under flat names — `invoice_number`, `invoice_date`, `sender_name`, `sender_address`,
  `sender_city`, `customer_name`, `customer_address`, `customer_city` and at least one `line_items`
  entry (BR-16) — but derives them from the nested structure these samples use.

A template that reads a field the data does not have makes the whole request fail with a 500 —
there is no silent fallback to an empty string, so keep templates and data in sync.

The generated XML is what the service produces; before going live, run it through a real XRechnung
validator to confirm it satisfies the CIUS rules your recipients enforce.
