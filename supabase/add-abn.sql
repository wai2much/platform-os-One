-- An Australian tax invoice for more than $82.50 (inc GST) must show the
-- supplier's ABN. The org business profile had every other field the invoice
-- needs — name, address, phone, email, bank details — but no ABN, so every
-- invoice this product has ever produced was missing a legally required
-- field. This adds it; Settings.jsx edits it; invoicePdf.js prints it, and
-- says so loudly on the document when it is blank rather than quietly
-- producing an invalid invoice that looks finished.
alter table organizations add column if not exists abn text not null default '';

-- Not every business is GST registered. One that is not may not issue a
-- document headed "tax invoice" or charge GST, so the PDF drops the GST lines
-- and the "Tax" from the title when this is false. Defaults true, which is the
-- common case for an established workshop.
alter table organizations add column if not exists gst_registered boolean not null default true;
