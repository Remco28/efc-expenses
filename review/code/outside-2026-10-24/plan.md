# The author's plan for the six (written as if not yet built)

1. **Late refresh.** A reload fetches into a local value and only replaces the app's loaded trip if the screen is still that trip's screen. Every reload helper does the same; the normal page load already checks.
2. **Save's first check.** Freeze the form (and the Save button) the moment Save is tapped, before the first check, and unfreeze it on every way out that doesn't leave the form (a refusal, "who's on the trip changed", no signal while the expense can't wait).
3. **Reused family numbers in a kept form.** When a family is picked on the form (as payer or ticked), remember its tag with the form. Saving sends those remembered tags, not ones looked up now; the server already refuses a tag that doesn't match. When a kept form is reopened, any pick whose family's tag no longer matches (or that has no remembered tag, as in a form kept before this change) is cleared, with a message: "Some families on this expense changed since it was started."
4. **Name vs Fencer.** The person update writes only the fields that were sent; the others keep whatever the database holds at the moment of writing.
5. **Treasurer vs fingerprint.** Read the trip's row inside the same batch as everything else and the fingerprint. (Keep a first check that the trip exists, for the "doesn't exist or was deleted" answer.)
6. **Person into a replaced family.** The insert itself requires the family on that number to still have the tag the screen sent; otherwise the answer is "this screen is out of date, reload".
