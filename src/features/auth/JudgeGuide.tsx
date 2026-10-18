export function JudgeGuide() {
  return <details className="judge-guide">
    <summary>Demo guide: try both roles</summary>
    <div className="judge-guide-content">
      <p>Get the student and manager sign-in details privately from the organizer. Use accounts for the same school to follow one item through the demo.</p>
      <p>You can also register a new demo account and enter the private code to join School A as a student. Email ownership and school identity are not verified.</p>
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
