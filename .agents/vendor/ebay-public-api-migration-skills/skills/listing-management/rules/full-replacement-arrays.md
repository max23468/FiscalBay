# Treat Listing Arrays As Full Replacements

## Why this matters

For both `updateListing` and `relistListing`, array fields are replaced as full arrays, not patched element-by-element.

## Rule

- When revising or relisting, send the full desired array for image URLs, aspects, and similar list-shaped fields.
- Do not assume you can append or partially update list entries without restating the rest of the array.

## Typical Risk Areas

- `imageUrls`
- product aspects
- variation metadata
- other list-shaped fields where the modern API expects the final desired state

## Notes

- Use this rule together with `variation-to-items.md` when a revise or relist touches multi-SKU data.
