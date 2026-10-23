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

The footer prints these identifiers for the PDF. The invoice data carries them as well, because an
e-invoice needs them as structured fields: VAT ID, phone, email and IBAN of the seller, and an
email address of the buyer.

## What the samples exercise

- a `text` line item without position or price, alongside priced `article` items,
- a second address block that stays hidden because `recipient.company.name` is empty,
- a VAT rate (7 %) listed in `totals.vat_rates` that no line item uses, so the template has to
  suppress that row,
- on the invoice, the optional order number (`references.order_id`), delivery note number
  (`references.delivery_note_id`), due date (`payment.due_date`) and delivery terms
  (`delivery.terms`), each wrapped in a guard so the template still renders when they are absent.
  All four are Contract fields; the order number and the due date also reach the e-invoice XML,
- on the invoice, every field an XRechnung requires: the seller's VAT ID
  (`sender.company.tax_number`), contact details (`sender.contact_details`) and IBAN
  (`sender.bank.iban`), and the buyer's email address (`customer.contact_details.email`), which the
  service writes as the buyer's electronic address.

## Document data contract

The invoice examples need Collana Docs 1.10.0 or later. An older instance accepts them but ignores
the fields it does not know yet, so its e-invoice silently lacks them.

The service validates `document.json` against its own JSON schema and is strict about it:

- `schema_version` must be the integer `1`, at the root.
- A `document` object must be present at the root.
- **Every numeric value is a string**: `position`, `tax_rate`, `quantity`, `unit_price`,
  `net_amount`, `totals.*` and `vat_rates[].rate`. Sending `19` instead of `"19"` is rejected.
- For `XRechnung` and `PdfMitZugferd` further fields are mandatory; the service names each missing
  one by its path, e.g. `sender.company.tax_number`. The full list per format is in the
  [main README](../README.md#required-fields-for-e-invoices).

A template that reads a field the data does not have renders it empty. Reading through a missing
intermediate object (`d.missing.field`) and Scriban syntax errors fail the request with a 400 that
names the template part and the position.

The output of both invoice examples has been checked: the XRechnung XML with the
[KoSIT validator](https://github.com/itplr-kosit/validator) and its XRechnung 3.0.2 configuration,
the ZUGFeRD PDF and its embedded XML with the [Mustang validator](https://github.com/ZUGFeRD/mustangproject).
For your own data, run the output through a validator before going live to confirm it satisfies
the rules your recipients enforce.
