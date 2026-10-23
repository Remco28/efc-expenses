### [MEDIUM] Edits made during an expense save are discarded
public/app.js:1051. Scenario: Save an expense on slow Wi-Fi, then correct its amount or split while the request is pending; those controls remain enabled. Wrong outcome: The request saves the earlier values, then its success clears the same draft and navigates away, silently losing the correction. Suggested fix: Disable editing during submission, or track draft changes and preserve edits made after submission.

### [MEDIUM] An older failed save can allow duplicate expenses
public/app.js:1050. Scenario: Save expense A, navigate away while it is pending, then start saving new expense B. A’s request fails while B’s request is pending. Wrong outcome: A’s failure handler enables B’s Save button. Tapping it submits B again, creating two expenses because submission has no independent pending guard. Suggested fix: Track submission state per draft and only change the originating draft’s button.

### [MEDIUM] Failed person addition overwrites the next typed name
public/app.js:779. Scenario: Submit “Alice,” then type “Bob” into the cleared new-person field while Alice’s request is pending. Alice’s request fails. Wrong outcome: The redraw preserves “Bob,” but the failure handler immediately replaces it with “Alice,” silently discarding the next entry. Suggested fix: Restore the failed submission only if the new-person fields are still untouched; otherwise preserve the newer input.
