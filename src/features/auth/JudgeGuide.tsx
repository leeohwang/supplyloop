export function JudgeGuide() {
  return <details className="judge-guide">
    <summary>Judge guide: create an account and try both roles</summary>
    <div className="judge-guide-content">
      <p>Choose Create account to make your own SupplyLoop account. Confirm your email with its personal code, then enter the private school join code shared by the organizer to join fictional School A as a student. School identity is not verified.</p>
      <p>To try Manager desk, get the School A manager sign-in details privately from the organizer. Existing student and manager accounts also remain available. Use accounts for the same school to follow one item through the walkthrough.</p>
      <ol>
        <li><strong>Manager desk:</strong> receive an item, complete its details, then inspect and publish it.</li>
        <li><strong>Student:</strong> find the item, reserve it, and open My pickups to see the reservation.</li>
        <li><strong>Manager desk:</strong> find the student in the pickup queue and confirm collection.</li>
        <li><strong>Student:</strong> return to My pickups to see the completed collection.</li>
      </ol>
      <p>Sign out before changing accounts, or use independent browser profiles. Students reserve items; managers manage inventory and handoffs.</p>
      <p className="judge-guide-note">All data is fictional. Changes are saved to shared demo inventory, so another judge may reserve an item first.</p>
    </div>
  </details>
}
